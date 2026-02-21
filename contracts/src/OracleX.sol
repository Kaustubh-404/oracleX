// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title OracleX
 * @notice AI-powered prediction market resolved by Chainlink CRE
 *
 * Flow:
 *   1. Anyone creates a market with a question + closing time
 *   2. Users buy YES or NO positions with USDC
 *   3. After closing time, anyone calls requestSettlement()
 *      → emits SettlementRequested (CRE EVM log trigger fires)
 *   4. CRE workflow fetches data from 3+ APIs, calls Groq AI,
 *      reaches BFT consensus, calls receiveSettlement()
 *   5. Winners claim their proportional share of the total pool
 */
contract OracleX is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────
    enum Outcome { UNRESOLVED, YES, NO, INVALID }

    struct Market {
        uint256 id;
        string  question;           // "Will BTC close above $95k on March 1?"
        string  category;           // "crypto" | "sports" | "tech" | "news"
        string  resolutionSource;   // "BTC/USD" | "basketball_nba" | keyword
        uint256 closingTime;        // no new bets after this
        uint256 settlementDeadline; // must settle before this (safety)
        address collateral;         // USDC address
        uint256 yesPool;            // total USDC backing YES
        uint256 noPool;             // total USDC backing NO
        Outcome outcome;
        bool    settlementRequested;
        uint256 aiConfidenceBps;    // AI confidence 0-10000 (10000 = 100%)
        address creator;
    }

    // ─────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────
    mapping(uint256 => Market)  public markets;
    mapping(address => mapping(uint256 => uint256)) public yesPositions;
    mapping(address => mapping(uint256 => uint256)) public noPositions;

    uint256 public marketCount;
    uint256 public protocolFeeBps = 100;  // 1% protocol fee

    /// @notice Address of the CRE forwarder — only this can call receiveSettlement()
    /// @dev For hackathon simulation: set this to your own wallet address,
    ///      then call receiveSettlement() manually after running `cre simulation run`
    address public creForwarder;

    /// @notice Minimum AI confidence required for auto-settlement (80%)
    uint256 public constant MIN_CONFIDENCE_BPS = 8000;

    uint256 public constant MIN_INITIAL_LIQUIDITY = 10 * 1e6; // 10 USDC
    uint256 public constant MIN_POSITION_SIZE     = 1 * 1e6;  // 1 USDC

    // ─────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────
    event MarketCreated(
        uint256 indexed marketId,
        string  question,
        string  category,
        uint256 closingTime,
        address creator
    );

    event PositionTaken(
        uint256 indexed marketId,
        address indexed user,
        bool    isYes,
        uint256 amount
    );

    event PositionSold(
        uint256 indexed marketId,
        address indexed user,
        bool    isYes,
        uint256 amountIn,
        uint256 proceeds
    );

    /// @notice CRE EVM log trigger listens for this event
    event SettlementRequested(
        uint256 indexed marketId,
        string  question,
        uint256 requestedAt
    );

    event MarketSettled(
        uint256 indexed marketId,
        Outcome outcome,
        uint256 confidenceBps,
        string  aiReasoning
    );

    event WinningsClaimed(
        uint256 indexed marketId,
        address indexed user,
        uint256 amount
    );

    event CreForwarderUpdated(address indexed oldForwarder, address indexed newForwarder);

    // ─────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────
    constructor(address _creForwarder) Ownable(msg.sender) {
        require(_creForwarder != address(0), "CRE forwarder cannot be zero");
        creForwarder = _creForwarder;
    }

    // ─────────────────────────────────────────────────
    // Market Creation
    // ─────────────────────────────────────────────────

    /**
     * @notice Create a new prediction market
     * @param question       Plain English question, e.g. "Will ETH hit $4k before March 31?"
     * @param category       "crypto" | "sports" | "tech" | "news"
     * @param resolutionSource  Data source identifier (e.g. "ETH/USD", "basketball_nba")
     * @param closingTime    Unix timestamp — trading stops here
     * @param settlementDeadline Unix timestamp — must resolve before this
     * @param collateralToken   ERC20 token for collateral (USDC)
     * @param initialLiquidity  USDC to seed both YES and NO pools equally
     */
    function createMarket(
        string  calldata question,
        string  calldata category,
        string  calldata resolutionSource,
        uint256 closingTime,
        uint256 settlementDeadline,
        address collateralToken,
        uint256 initialLiquidity
    ) external nonReentrant returns (uint256 marketId) {
        require(bytes(question).length > 0,           "Question required");
        require(closingTime > block.timestamp,         "Closing time must be future");
        require(settlementDeadline > closingTime,      "Deadline must be after closing");
        require(collateralToken != address(0),         "Invalid collateral");
        require(initialLiquidity >= MIN_INITIAL_LIQUIDITY, "Min 10 USDC initial liquidity");

        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), initialLiquidity);

        marketId = ++marketCount;
        markets[marketId] = Market({
            id:                  marketId,
            question:            question,
            category:            category,
            resolutionSource:    resolutionSource,
            closingTime:         closingTime,
            settlementDeadline:  settlementDeadline,
            collateral:          collateralToken,
            yesPool:             initialLiquidity / 2,
            noPool:              initialLiquidity / 2,
            outcome:             Outcome.UNRESOLVED,
            settlementRequested: false,
            aiConfidenceBps:     0,
            creator:             msg.sender
        });

        emit MarketCreated(marketId, question, category, closingTime, msg.sender);
    }

    // ─────────────────────────────────────────────────
    // Trading
    // ─────────────────────────────────────────────────

    /// @notice Buy YES shares — bet the event will happen
    function buyYes(uint256 marketId, uint256 amount) external nonReentrant {
        _validateTrade(marketId, amount);
        Market storage m = markets[marketId];

        IERC20(m.collateral).safeTransferFrom(msg.sender, address(this), amount);
        m.yesPool += amount;
        yesPositions[msg.sender][marketId] += amount;

        emit PositionTaken(marketId, msg.sender, true, amount);
    }

    /// @notice Buy NO shares — bet the event will NOT happen
    function buyNo(uint256 marketId, uint256 amount) external nonReentrant {
        _validateTrade(marketId, amount);
        Market storage m = markets[marketId];

        IERC20(m.collateral).safeTransferFrom(msg.sender, address(this), amount);
        m.noPool += amount;
        noPositions[msg.sender][marketId] += amount;

        emit PositionTaken(marketId, msg.sender, false, amount);
    }

    /**
     * @notice Exit a position before market closes at current market price.
     * @dev Price = current pool ratio. Spread (position - proceeds) redistributes
     *      to the other side's pool. Protocol fee (1%) taken on proceeds.
     * @param marketId  Target market
     * @param isYes     true = sell YES position, false = sell NO position
     * @param amount    Amount of position (in USDC units) to sell
     */
    function sellShares(uint256 marketId, bool isYes, uint256 amount) external nonReentrant {
        require(marketId > 0 && marketId <= marketCount, "Market not found");
        Market storage m = markets[marketId];
        require(block.timestamp < m.closingTime,  "Market closed");
        require(m.outcome == Outcome.UNRESOLVED,  "Already resolved");
        require(amount >= MIN_POSITION_SIZE,       "Min 1 USDC");

        uint256 totalPool = m.yesPool + m.noPool;
        require(totalPool > 0, "Empty pool");

        uint256 proceeds;
        if (isYes) {
            require(yesPositions[msg.sender][marketId] >= amount, "Insufficient YES position");
            // Sell at current YES implied price: amount × (yesPool / totalPool)
            proceeds = (amount * m.yesPool) / totalPool;
            yesPositions[msg.sender][marketId] -= amount;
            m.yesPool -= amount;
            m.noPool  += (amount - proceeds); // spread stays in pool for NO holders
        } else {
            require(noPositions[msg.sender][marketId] >= amount, "Insufficient NO position");
            proceeds = (amount * m.noPool) / totalPool;
            noPositions[msg.sender][marketId] -= amount;
            m.noPool  -= amount;
            m.yesPool += (amount - proceeds); // spread stays in pool for YES holders
        }

        require(proceeds > 0, "Zero proceeds");

        uint256 fee       = (proceeds * protocolFeeBps) / 10000;
        uint256 netPayout = proceeds - fee;

        if (fee > 0) {
            IERC20(m.collateral).safeTransfer(owner(), fee);
        }
        IERC20(m.collateral).safeTransfer(msg.sender, netPayout);

        emit PositionSold(marketId, msg.sender, isYes, amount, netPayout);
    }

    function _validateTrade(uint256 marketId, uint256 amount) internal view {
        require(marketId > 0 && marketId <= marketCount, "Market not found");
        Market storage m = markets[marketId];
        require(block.timestamp < m.closingTime,           "Market closed");
        require(m.outcome == Outcome.UNRESOLVED,           "Market already resolved");
        require(amount >= MIN_POSITION_SIZE,               "Min 1 USDC");
    }

    // ─────────────────────────────────────────────────
    // Settlement Request (triggers CRE workflow)
    // ─────────────────────────────────────────────────

    /**
     * @notice Trigger CRE resolution — call after closingTime
     * @dev Anyone can call this. Emits SettlementRequested which the
     *      CRE EVM log trigger listens for and fires the AI resolution workflow.
     */
    function requestSettlement(uint256 marketId) external {
        require(marketId > 0 && marketId <= marketCount, "Market not found");
        Market storage m = markets[marketId];
        require(block.timestamp >= m.closingTime,    "Market not closed yet");
        require(m.outcome == Outcome.UNRESOLVED,     "Already resolved");
        require(!m.settlementRequested,              "Settlement already requested");

        m.settlementRequested = true;

        // CRE EVM log trigger fires on this ↓
        emit SettlementRequested(marketId, m.question, block.timestamp);
    }

    // ─────────────────────────────────────────────────
    // CRE Settlement Receiver
    // ─────────────────────────────────────────────────

    /**
     * @notice Called by the CRE DON after AI resolution reaches BFT consensus
     * @dev Only the CRE forwarder address can call this.
     *      For hackathon demo: set creForwarder to your own wallet,
     *      call this manually after `cre simulation run` to simulate CRE.
     * @param marketId      The market to settle
     * @param outcomeValue  1=YES, 2=NO, 3=INVALID
     * @param confidenceBps AI confidence in basis points (8000 = 80% minimum)
     * @param aiReasoning   Plain English explanation stored onchain for transparency
     */
    function receiveSettlement(
        uint256 marketId,
        uint8   outcomeValue,
        uint256 confidenceBps,
        string  calldata aiReasoning
    ) external {
        require(msg.sender == creForwarder,               "Only CRE forwarder");
        require(marketId > 0 && marketId <= marketCount,  "Market not found");

        Market storage m = markets[marketId];
        require(m.outcome == Outcome.UNRESOLVED,          "Already resolved");
        require(m.settlementRequested,                    "Settlement not requested");
        require(confidenceBps >= MIN_CONFIDENCE_BPS,      "AI confidence too low (min 80%)");
        require(outcomeValue >= 1 && outcomeValue <= 3,   "Invalid outcome value");

        m.outcome        = Outcome(outcomeValue);
        m.aiConfidenceBps = confidenceBps;

        emit MarketSettled(marketId, m.outcome, confidenceBps, aiReasoning);
    }

    // ─────────────────────────────────────────────────
    // Claim Winnings
    // ─────────────────────────────────────────────────

    /**
     * @notice Claim winnings after market resolution
     * @dev Winners get proportional share of total pool minus protocol fee.
     *      If INVALID, both sides get refunded pro-rata.
     */
    function claimWinnings(uint256 marketId) external nonReentrant {
        require(marketId > 0 && marketId <= marketCount, "Market not found");
        Market storage m = markets[marketId];
        require(m.outcome != Outcome.UNRESOLVED, "Market not resolved yet");

        uint256 userYes = yesPositions[msg.sender][marketId];
        uint256 userNo  = noPositions[msg.sender][marketId];
        uint256 payout;
        uint256 totalPool = m.yesPool + m.noPool;

        if (m.outcome == Outcome.YES) {
            require(userYes > 0, "No YES position");
            payout = (userYes * totalPool) / m.yesPool;
            yesPositions[msg.sender][marketId] = 0;

        } else if (m.outcome == Outcome.NO) {
            require(userNo > 0, "No NO position");
            payout = (userNo * totalPool) / m.noPool;
            noPositions[msg.sender][marketId] = 0;

        } else {
            // INVALID — refund both sides
            require(userYes + userNo > 0, "No position to refund");
            payout = userYes + userNo;
            yesPositions[msg.sender][marketId] = 0;
            noPositions[msg.sender][marketId]  = 0;
        }

        require(payout > 0, "Nothing to claim");

        // Apply protocol fee (not on INVALID refunds)
        uint256 fee = (m.outcome != Outcome.INVALID)
            ? (payout * protocolFeeBps) / 10000
            : 0;
        uint256 netPayout = payout - fee;

        if (fee > 0) {
            IERC20(m.collateral).safeTransfer(owner(), fee);
        }
        IERC20(m.collateral).safeTransfer(msg.sender, netPayout);

        emit WinningsClaimed(marketId, msg.sender, netPayout);
    }

    // ─────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────

    function getMarket(uint256 marketId) external view returns (Market memory) {
        require(marketId > 0 && marketId <= marketCount, "Market not found");
        return markets[marketId];
    }

    /// @return yesPct YES probability 0-100
    /// @return noPct  NO probability 0-100
    function getOdds(uint256 marketId) external view returns (uint256 yesPct, uint256 noPct) {
        Market storage m = markets[marketId];
        uint256 total = m.yesPool + m.noPool;
        if (total == 0) return (50, 50);
        yesPct = (m.yesPool * 100) / total;
        noPct  = 100 - yesPct;
    }

    function getUserPositions(uint256 marketId, address user)
        external view returns (uint256 yesAmount, uint256 noAmount)
    {
        return (yesPositions[user][marketId], noPositions[user][marketId]);
    }

    /// @notice Returns all active (unresolved) market IDs — for frontend discovery
    function getActiveMarkets() external view returns (uint256[] memory) {
        uint256 count;
        for (uint256 i = 1; i <= marketCount; i++) {
            if (markets[i].outcome == Outcome.UNRESOLVED) count++;
        }
        uint256[] memory ids = new uint256[](count);
        uint256 idx;
        for (uint256 i = 1; i <= marketCount; i++) {
            if (markets[i].outcome == Outcome.UNRESOLVED) ids[idx++] = i;
        }
        return ids;
    }

    // ─────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────

    function setCreForwarder(address _new) external onlyOwner {
        require(_new != address(0), "Cannot be zero");
        emit CreForwarderUpdated(creForwarder, _new);
        creForwarder = _new;
    }

    function setProtocolFee(uint256 feeBps) external onlyOwner {
        require(feeBps <= 500, "Max 5%");
        protocolFeeBps = feeBps;
    }

    /// @notice Emergency: manually settle if CRE is unavailable past deadline
    function emergencySettle(uint256 marketId, uint8 outcomeValue) external onlyOwner {
        Market storage m = markets[marketId];
        require(block.timestamp > m.settlementDeadline, "Deadline not passed");
        require(m.outcome == Outcome.UNRESOLVED,        "Already resolved");
        m.outcome = Outcome(outcomeValue);
        emit MarketSettled(marketId, m.outcome, 0, "Emergency admin settlement");
    }
}
