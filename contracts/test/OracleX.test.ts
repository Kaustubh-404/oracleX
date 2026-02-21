import { expect } from "chai";
import { ethers } from "hardhat";
import { OracleX, MockUSDC } from "../typechain-types";
import { Signer } from "ethers";

describe("OracleX", function () {
  let oracleX: OracleX;
  let usdc: MockUSDC;
  let owner: Signer;
  let alice: Signer;
  let bob: Signer;
  let creForwarder: Signer;

  const INITIAL_LIQUIDITY = ethers.parseUnits("100", 6); // 100 USDC
  const BET_AMOUNT = ethers.parseUnits("10", 6);         // 10 USDC

  beforeEach(async () => {
    [owner, alice, bob, creForwarder] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDCFactory.deploy() as MockUSDC;

    // Deploy OracleX with creForwarder
    const OracleXFactory = await ethers.getContractFactory("OracleX");
    oracleX = await OracleXFactory.deploy(await creForwarder.getAddress()) as OracleX;

    // Fund alice and bob
    await usdc.faucet(await alice.getAddress(), ethers.parseUnits("1000", 6));
    await usdc.faucet(await bob.getAddress(),   ethers.parseUnits("1000", 6));
    await usdc.faucet(await owner.getAddress(), ethers.parseUnits("1000", 6));
  });

  async function createTestMarket(closingOffset = 3600) {
    const usdcAddress = await usdc.getAddress();
    const oracleXAddress = await oracleX.getAddress();
    const closingTime = Math.floor(Date.now() / 1000) + closingOffset;
    const settlementDeadline = closingTime + 86400;

    await usdc.connect(owner).approve(oracleXAddress, INITIAL_LIQUIDITY);
    const tx = await oracleX.connect(owner).createMarket(
      "Will ETH hit $4,000 before deadline?",
      "crypto",
      "ETH/USD",
      closingTime,
      settlementDeadline,
      usdcAddress,
      INITIAL_LIQUIDITY
    );
    const receipt = await tx.wait();
    return { marketId: 1n, closingTime, settlementDeadline };
  }

  // ─────────────────────────────────────────────────
  describe("Market Creation", () => {
    it("creates a market with correct initial state", async () => {
      await createTestMarket();
      const market = await oracleX.getMarket(1n);

      expect(market.question).to.equal("Will ETH hit $4,000 before deadline?");
      expect(market.category).to.equal("crypto");
      expect(market.yesPool).to.equal(INITIAL_LIQUIDITY / 2n);
      expect(market.noPool).to.equal(INITIAL_LIQUIDITY / 2n);
      expect(market.outcome).to.equal(0); // UNRESOLVED
      expect(market.creator).to.equal(await owner.getAddress());
    });

    it("emits MarketCreated event", async () => {
      const usdcAddress = await usdc.getAddress();
      const oracleXAddress = await oracleX.getAddress();
      const closingTime = Math.floor(Date.now() / 1000) + 3600;

      await usdc.connect(owner).approve(oracleXAddress, INITIAL_LIQUIDITY);
      await expect(
        oracleX.connect(owner).createMarket(
          "Test market?", "crypto", "ETH/USD",
          closingTime, closingTime + 86400,
          usdcAddress, INITIAL_LIQUIDITY
        )
      ).to.emit(oracleX, "MarketCreated").withArgs(1n, "Test market?", "crypto", closingTime, await owner.getAddress());
    });

    it("reverts with closing time in the past", async () => {
      const usdcAddress = await usdc.getAddress();
      const oracleXAddress = await oracleX.getAddress();
      await usdc.connect(owner).approve(oracleXAddress, INITIAL_LIQUIDITY);

      await expect(
        oracleX.connect(owner).createMarket(
          "Bad market?", "crypto", "ETH/USD",
          1000, 2000, usdcAddress, INITIAL_LIQUIDITY
        )
      ).to.be.revertedWith("Closing time must be future");
    });

    it("reverts with insufficient initial liquidity", async () => {
      const usdcAddress = await usdc.getAddress();
      const oracleXAddress = await oracleX.getAddress();
      const tiny = ethers.parseUnits("1", 6); // 1 USDC (below 10 USDC min)
      await usdc.connect(owner).approve(oracleXAddress, tiny);

      await expect(
        oracleX.connect(owner).createMarket(
          "Bad market?", "crypto", "ETH/USD",
          Math.floor(Date.now() / 1000) + 3600,
          Math.floor(Date.now() / 1000) + 86400,
          usdcAddress, tiny
        )
      ).to.be.revertedWith("Min 10 USDC initial liquidity");
    });
  });

  // ─────────────────────────────────────────────────
  describe("Trading", () => {
    beforeEach(async () => {
      await createTestMarket();
      await usdc.connect(alice).approve(await oracleX.getAddress(), ethers.MaxUint256);
      await usdc.connect(bob).approve(await oracleX.getAddress(), ethers.MaxUint256);
    });

    it("allows buying YES positions", async () => {
      await oracleX.connect(alice).buyYes(1n, BET_AMOUNT);
      const [yesAmt] = await oracleX.getUserPositions(1n, await alice.getAddress());
      expect(yesAmt).to.equal(BET_AMOUNT);
    });

    it("allows buying NO positions", async () => {
      await oracleX.connect(bob).buyNo(1n, BET_AMOUNT);
      const [, noAmt] = await oracleX.getUserPositions(1n, await bob.getAddress());
      expect(noAmt).to.equal(BET_AMOUNT);
    });

    it("updates pools correctly", async () => {
      await oracleX.connect(alice).buyYes(1n, BET_AMOUNT);
      await oracleX.connect(bob).buyNo(1n, BET_AMOUNT);

      const market = await oracleX.getMarket(1n);
      expect(market.yesPool).to.equal(INITIAL_LIQUIDITY / 2n + BET_AMOUNT);
      expect(market.noPool).to.equal(INITIAL_LIQUIDITY / 2n + BET_AMOUNT);
    });

    it("updates odds after trading", async () => {
      // Buy a lot of YES — odds should shift toward YES
      await oracleX.connect(alice).buyYes(1n, ethers.parseUnits("50", 6));
      const [yesPct, noPct] = await oracleX.getOdds(1n);
      expect(yesPct).to.be.gt(50n);
      expect(noPct).to.be.lt(50n);
    });
  });

  // ─────────────────────────────────────────────────
  describe("Settlement", () => {
    let closingTime: number;

    beforeEach(async () => {
      // Create market that closes in 1 second (for testing)
      ({ closingTime } = await createTestMarket(1));
      await usdc.connect(alice).approve(await oracleX.getAddress(), ethers.MaxUint256);
      await usdc.connect(bob).approve(await oracleX.getAddress(), ethers.MaxUint256);
      await oracleX.connect(alice).buyYes(1n, BET_AMOUNT);
      await oracleX.connect(bob).buyNo(1n, BET_AMOUNT);
    });

    it("allows requesting settlement after closing", async () => {
      await ethers.provider.send("evm_increaseTime", [2]); // advance 2 seconds
      await ethers.provider.send("evm_mine", []);

      await expect(oracleX.requestSettlement(1n))
        .to.emit(oracleX, "SettlementRequested")
        .withArgs(1n, "Will ETH hit $4,000 before deadline?", (v: bigint) => v > 0n);
    });

    it("reverts requesting settlement before closing", async () => {
      await expect(oracleX.requestSettlement(1n))
        .to.be.revertedWith("Market not closed yet");
    });

    it("allows CRE forwarder to settle YES", async () => {
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
      await oracleX.requestSettlement(1n);

      await expect(
        oracleX.connect(creForwarder).receiveSettlement(1n, 1, 9000n, "BTC price confirmed above target")
      )
        .to.emit(oracleX, "MarketSettled")
        .withArgs(1n, 1n, 9000n, "BTC price confirmed above target");

      const market = await oracleX.getMarket(1n);
      expect(market.outcome).to.equal(1); // YES
    });

    it("reverts if non-forwarder tries to settle", async () => {
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
      await oracleX.requestSettlement(1n);

      await expect(
        oracleX.connect(alice).receiveSettlement(1n, 1, 9000n, "hack attempt")
      ).to.be.revertedWith("Only CRE forwarder");
    });

    it("reverts settlement with low AI confidence", async () => {
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
      await oracleX.requestSettlement(1n);

      await expect(
        oracleX.connect(creForwarder).receiveSettlement(1n, 1, 7999n, "low confidence")
      ).to.be.revertedWith("AI confidence too low (min 80%)");
    });
  });

  // ─────────────────────────────────────────────────
  describe("Claim Winnings", () => {
    beforeEach(async () => {
      await createTestMarket(1);
      await usdc.connect(alice).approve(await oracleX.getAddress(), ethers.MaxUint256);
      await usdc.connect(bob).approve(await oracleX.getAddress(), ethers.MaxUint256);
      await oracleX.connect(alice).buyYes(1n, BET_AMOUNT);  // alice bets YES
      await oracleX.connect(bob).buyNo(1n, BET_AMOUNT);     // bob bets NO

      // Advance time and settle
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
      await oracleX.requestSettlement(1n);
    });

    it("YES winner claims correctly", async () => {
      await oracleX.connect(creForwarder).receiveSettlement(1n, 1, 9000n, "YES wins");

      const balanceBefore = await usdc.balanceOf(await alice.getAddress());
      await oracleX.connect(alice).claimWinnings(1n);
      const balanceAfter = await usdc.balanceOf(await alice.getAddress());

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("NO winner claims correctly", async () => {
      await oracleX.connect(creForwarder).receiveSettlement(1n, 2, 9000n, "NO wins");

      const balanceBefore = await usdc.balanceOf(await bob.getAddress());
      await oracleX.connect(bob).claimWinnings(1n);
      const balanceAfter = await usdc.balanceOf(await bob.getAddress());

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("INVALID market refunds both sides", async () => {
      await oracleX.connect(creForwarder).receiveSettlement(1n, 3, 8000n, "Data insufficient");

      const aliceBefore = await usdc.balanceOf(await alice.getAddress());
      const bobBefore   = await usdc.balanceOf(await bob.getAddress());

      await oracleX.connect(alice).claimWinnings(1n);
      await oracleX.connect(bob).claimWinnings(1n);

      const aliceAfter = await usdc.balanceOf(await alice.getAddress());
      const bobAfter   = await usdc.balanceOf(await bob.getAddress());

      // Both get full refund (no fee on INVALID)
      expect(aliceAfter - aliceBefore).to.equal(BET_AMOUNT);
      expect(bobAfter   - bobBefore).to.equal(BET_AMOUNT);
    });

    it("loser cannot claim", async () => {
      await oracleX.connect(creForwarder).receiveSettlement(1n, 1, 9000n, "YES wins");
      await expect(oracleX.connect(bob).claimWinnings(1n))
        .to.be.revertedWith("No NO position");
    });
  });
});
