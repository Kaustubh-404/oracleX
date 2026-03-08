# OracleX — AI-Powered Prediction Markets via Chainlink CRE

> **Chainlink Convergence Hackathon 2026** | Tracks: Prediction Markets, CRE & AI, Best use of World ID with CRE, Best usage of CRE within a World Mini App

OracleX is a fully on-chain prediction market platform where **every outcome is resolved by AI running inside the Chainlink Runtime Environment (CRE)**. No governance tokens. No manual resolution. No manipulation. Built primarily as a **World Mini App** on World Chain mainnet — open in World App, trade gas-free, verify with World ID, and let Chainlink's decentralized oracle network settle every market using AI.

---

## Table of Contents

- [What Makes OracleX Different](#what-makes-oraclex-different)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
  - [Market Creation](#1-market-creation)
  - [Share Buying (Pool-Based Pricing)](#2-share-buying-pool-based-pricing)
  - [Share Selling (Exit Before Close)](#3-share-selling-exit-before-close)
  - [AI Settlement via Chainlink CRE](#4-ai-settlement-via-chainlink-cre)
  - [Outcomes: Win, Lose, Invalid](#5-outcomes-win-lose-invalid)
  - [Claiming Rewards](#6-claiming-rewards)
- [World Mini App](#world-mini-app)
- [Hackathon Track Alignment](#hackathon-track-alignment)
- [Tech Stack](#tech-stack)
- [Repo Structure](#repo-structure)
- [Local Setup](#local-setup)
  - [Prerequisites](#prerequisites)
  - [1. Smart Contracts](#1-smart-contracts)
  - [2. Backend](#2-backend)
  - [3. Frontend](#3-frontend)
  - [4. World Mini App Configuration](#4-world-mini-app-configuration)
  - [5. CRE Workflow](#5-cre-workflow)
- [Deployed Contracts](#deployed-contracts)
- [Files Using Chainlink](#files-using-chainlink)
- [License](#license)

---

## Try It Out

**World Mini App:** [Open in World App](https://world.org/mini-app?app_id=app_b159f2daf0166e319f176436aaa283f4&path=&draft_id=meta_37b70a54028506ce2c0ff3fe6789ea08)

> Open the link on your phone with World App installed to launch OracleX as a mini app. Trade prediction markets gas-free on World Chain with World ID verification.

**Demo Video:** [Watch on YouTube](https://youtu.be/S4h_PYaZUGc)

---

## What Makes OracleX Different

| Traditional Prediction Markets | OracleX |
|-------------------------------|---------|
| Outcomes resolved by governance vote or manual admin | **AI resolves every market** — Groq llama-3.3-70b reads real-world data and decides |
| Single oracle / centralized resolution | **Chainlink CRE DON** — multiple nodes must reach identical consensus |
| Low confidence = wrong answer forced | **Confidence threshold** — below 80% → market INVALID, everyone refunded |
| Web-only, wallet-connect friction | **World Mini App** — open in World App, gas-free transactions, 1-tap trading |
| Single chain | **Multi-chain** — Ethereum Sepolia (web) + World Chain mainnet (mini app) |
| No sybil resistance | **World ID integration** — proof of unique humanness before creating markets |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OracleX Platform                            │
├──────────────────────┬──────────────────────────────────────────────┤
│   Web App (Sepolia)  │        World Mini App (World Chain 480)      │
│   thirdweb v5 wallet │        MiniKit SDK · gas-free txs            │
│   MetaMask / WC      │        World ID verification                 │
└──────────┬───────────┴──────────────────┬───────────────────────────┘
           │                              │
           ▼                              ▼
    OracleX.sol (Sepolia)         OracleX.sol (World Chain 480)
           │                              │
           │  requestSettlement()         │  requestSettlement()
           ▼                              ▼
    SettlementRequested event      SettlementRequested event
           │                              │
           ▼                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Chainlink CRE DON (per chain)                     │
│                                                                      │
│  1. EVM Log Trigger detects SettlementRequested event                │
│  2. callContract() → reads market question + category from chain     │
│  3. Per-node execution (multiple nodes):                             │
│     • HTTPClient → CoinGecko API (crypto prices)                     │
│     • HTTPClient → The Odds API (sports results)                     │
│     • HTTPClient → NewsAPI (news events)                             │
│     • HTTPClient → Groq AI (llama-3.3-70b-versatile)                 │
│       └─ Structured prompt → { outcome, confidence_bps, reasoning }  │
│  4. consensusIdenticalAggregation — ALL nodes must agree              │
│  5. runtime.report() + EVMClient.writeReport()                       │
│     └─ Calls receiveSettlement(marketId, outcome, confidence, reason) │
└──────────────────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Backend (Node.js + Prisma + Supabase)              │
│                                                                      │
│  • Dual-chain indexer: watches events on BOTH Sepolia & World Chain  │
│  • REST API: GET /markets, /positions/:address, /leaderboard         │
│  • Socket.io: real-time marketCreated, positionTaken, marketSettled   │
│  • AI endpoint: POST /ai/generate-market (Groq auto-fill)            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## How It Works

### 1. Market Creation

Anyone can create a yes/no prediction market on any topic:

1. Choose a **category** (Crypto, Sports, Tech, News)
2. Write a **yes/no question** (e.g., "Will ETH be above $3,000 by June 2026?")
3. Optionally use **AI auto-fill** — Groq suggests resolution source and criteria
4. Set **duration** (how long the market stays open for trading)
5. Provide **initial liquidity** (minimum 10 USDC) — split 50/50 into YES and NO pools

In the World Mini App, **World ID verification** is required before creating a market — this prevents spam and sybil attacks by ensuring one unique human per market creation.

**Contract function:** `createMarket(question, category, resolutionSource, closingTime, settlementDeadline, collateral, initialLiquidity)`

### 2. Share Buying (Pool-Based Pricing)

OracleX uses a **pool-based ratio pricing** model. Each market has two liquidity pools:

- **YES Pool** — total USDC backing the YES outcome
- **NO Pool** — total USDC backing the NO outcome

**Price calculation:**
```
YES Price = yesPool / (yesPool + noPool)
NO Price  = noPool  / (yesPool + noPool)
```

For example, if YES pool = $60 and NO pool = $40:
- YES price = 60% ($0.60 per share)
- NO price = 40% ($0.40 per share)

**When you buy YES shares:**
1. Your USDC is added to `yesPool`
2. Your position is tracked: `yesPositions[user][marketId] += amount`
3. The YES price increases (because the YES pool grew relative to total)
4. The more people buy one side, the more expensive it gets

**When you buy NO shares:**
- Same logic but added to `noPool`, tracked in `noPositions`

**Contract functions:** `buyYes(marketId, amount)`, `buyNo(marketId, amount)`

### 3. Share Selling (Exit Before Close)

You can sell shares before the market closes to lock in profits or cut losses:

```
Exit proceeds = (yourShares × yourSidePool) / totalPool
Protocol fee  = 1% of proceeds
Net payout    = proceeds - fee
```

The spread (difference between your shares and proceeds) is redistributed to the opposite pool, maintaining market balance.

**Example:** You hold 100 YES shares. YES pool = $600, NO pool = $400, total = $1000.
- Proceeds = (100 × 600) / 1000 = $60
- Fee = $0.60 (1%)
- You receive = $59.40
- Spread ($40) goes to the NO pool

**Contract function:** `sellShares(marketId, isYes, amount)`

The frontend shows your current holdings count when the SELL tab is active, and caps the sell amount to your maximum position.

### 4. AI Settlement via Chainlink CRE

This is the core innovation. When a market's closing time passes:

1. **Anyone** taps "Request AI Settlement" → calls `requestSettlement(marketId)` on-chain
2. The contract emits a `SettlementRequested(marketId, question, timestamp)` event
3. The **Chainlink CRE EVM-log trigger** detects this event across all DON nodes
4. **Each DON node independently:**
   - Reads the market question and category from the blockchain via `EVMClient.callContract()`
   - Fetches real-world data from external APIs via `HTTPClient.sendRequest()`:
     - **CoinGecko** — live crypto prices (BTC, ETH, SOL)
     - **The Odds API** — sports results and odds
     - **NewsAPI** — recent news articles related to the question
   - Calls **Groq AI** (`llama-3.3-70b-versatile`) with a structured prompt containing the question + external data
   - AI returns a JSON response: `{ outcome: "YES"|"NO"|"INVALID", confidence_bps: 0-10000, reasoning: "..." }`
5. **`consensusIdenticalAggregation`** — ALL nodes must produce the exact same AI response (BFT consensus)
6. If confidence < 80% (8000 bps), outcome is forced to **INVALID**
7. The DON writes the settlement on-chain via `EVMClient.writeReport()` → `receiveSettlement()`

**Why this matters:** The AI is not running on a single server — it runs independently on every DON node, and they must all agree. This eliminates single points of failure, manipulation, and centralized control.

**Groq AI prompt (simplified):**
```
Market question: "Will ETH be above $3,000 by June 2026?"
Resolution source: CoinGecko API
External data: [live price data from CoinGecko]
Current time: 2026-06-01T00:00:00Z

→ AI responds: {"outcome": "YES", "confidence_bps": 9500, "reasoning": "ETH is at $3,200, above threshold"}
```

**Temperature: 0.1** — near-deterministic to ensure all nodes get the same answer.

### 5. Outcomes: Win, Lose, Invalid

After AI settlement, there are three possible outcomes:

#### YES (outcome = 1) or NO (outcome = 2)
- The AI determined the answer with **≥80% confidence**
- **Winners** (holders of the winning side) can claim proportional payouts from the total pool
- **Losers** (holders of the losing side) receive nothing — their funds go to winners

#### INVALID (outcome = 3)
- The AI could **not** determine the outcome with sufficient confidence
- This happens when:
  - The question is about a future event that hasn't occurred yet
  - Contradictory or insufficient data
  - The question is ambiguous or unanswerable
- **Everyone gets refunded** — both YES and NO holders get their full position back
- No protocol fee is charged on INVALID refunds

**Example:** "Will the Fed cut rates twice in 2026?" asked in March 2026. The AI marks this INVALID because 9 months of the year remain — insufficient evidence. Nobody loses money.

**Confidence threshold:** The contract enforces `confidenceBps >= 8000` (80%). The AI itself must also be confident its answer IS invalid when returning INVALID.

### 6. Claiming Rewards

After settlement, users go to the **Holdings** tab:

**If you won (your side matches the outcome):**
```
Payout = (yourShares × totalPool) / winningSidePool
Fee    = 1% of payout
Net    = payout - fee
```
Your shares give you a proportional claim on the entire pool (both YES and NO funds).

**If you lost (your side doesn't match):**
- Your position shows "Done" with "Lost — YES/NO won"
- No action needed, no funds to claim

**If INVALID:**
- Both YES and NO holders can claim **full refunds** (no fee)
- Position shows "Claimable" with amber badge

**Contract functions:** `claimWinnings(marketId)`, `claimRefund(marketId)`

---

## World Mini App

OracleX is built primarily as a **World Mini App** — a dApp that runs natively inside World App, reaching **10M+ verified humans**.

### Why World App?

- **Zero gas fees** — World Chain subsidizes gas for mini app transactions
- **No wallet setup** — users already have a wallet in World App
- **World ID** — built-in sybil resistance (proof of unique humanness)
- **1-tap trading** — MiniKit `sendTransaction` handles everything
- **Instant onboarding** — Sign in with World App → start trading immediately

### Technical Integration

| Feature | Implementation |
|---------|---------------|
| **Sign-in** | `MiniKit.commandsAsync.walletAuth()` — returns wallet address |
| **Trading** | `MiniKit.commandsAsync.sendTransaction()` — gas-free on World Chain |
| **Identity** | `MiniKit.commandsAsync.verify()` — World ID proof before market creation |
| **Token approval** | `MockUSDCWorld` contract with OracleX as `trustedOperator` — no `approve()` needed |
| **Chain** | World Chain mainnet (chain ID 480) — the only chain MiniKit supports |
| **Wallet persistence** | `localStorage` via `minikit-wallet.ts` — address persists across sessions |

### World App Challenges Solved

| Challenge | Solution |
|-----------|----------|
| World App blocks `approve()` calls in mini apps | Deployed `MockUSDCWorld` with OracleX as trusted operator — `transferFrom` works without approval |
| MiniKit only works on World Chain mainnet | Dual-chain architecture — separate contracts + CRE workflows per chain |
| No sequential transaction execution guarantee | Single-transaction flows — no approve→action batches |
| `sendTransaction` returns app-level ID, not tx hash | Backend indexer watches on-chain events for confirmation |
| MiniKit not installed warnings in browser | `isMiniApp()` guard — graceful degradation to thirdweb wallet in browser |
| `useActiveAccount()` returns undefined for MiniKit users | `getMiniKitAddress()` from localStorage for chain reads + position tracking |

### MockUSDCWorld Token

World App mini apps cannot call `approve()` on ERC20 tokens. OracleX solves this with a custom USDC contract:

```solidity
// If OracleX (trustedOperator) calls transferFrom, no approval needed
function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
    if (msg.sender == trustedOperator) {
        _transfer(from, to, amount);
        return true;
    }
    return super.transferFrom(from, to, amount);
}
```

Users can mint test USDC via `faucet()` (max 10,000 per call).

---

## Hackathon Track Alignment

### Track 1: Prediction Markets

OracleX is a **decentralized prediction market** with automated, verifiable settlement:
- Users create yes/no markets on any topic (crypto, sports, tech, news)
- USDC-denominated positions with pool-based ratio pricing
- **AI-powered settlement** — Groq llama-3.3-70b analyzes real-world data sources
- **Confidence gating** — below 80% confidence → INVALID outcome → full refunds
- Multi-source data: CoinGecko (crypto), The Odds API (sports), NewsAPI (news)

**Chainlink files**: [`cre-workflow/workflows/market-resolver/main.ts`](cre-workflow/workflows/market-resolver/main.ts), [`contracts/src/OracleX.sol`](contracts/src/OracleX.sol)

### Track 2: CRE & AI

The CRE workflow is the **core orchestration layer** — AI doesn't just assist, it *is* the oracle:
- **EVM log trigger** → detects `SettlementRequested` on-chain events
- **EVMClient.callContract()** → reads market details from the blockchain
- **HTTPClient** → fetches real-time data from 3 external APIs
- **Groq AI (llama-3.3-70b)** → structured JSON prompt → `{outcome, confidence_bps, reasoning}`
- **consensusIdenticalAggregation** → all DON nodes must produce identical AI results
- **EVMClient.writeReport()** → writes the verified AI decision on-chain

**Chainlink files**:
- Sepolia: [`cre-workflow/workflows/market-resolver/main.ts`](cre-workflow/workflows/market-resolver/main.ts), [`workflow.yaml`](cre-workflow/workflows/market-resolver/workflow.yaml)
- World Chain: [`cre-workflow/workflows/world-resolver/main.ts`](cre-workflow/workflows/world-resolver/main.ts), [`workflow.yaml`](cre-workflow/workflows/world-resolver/workflow.yaml)
- Contract: [`contracts/src/OracleX.sol`](contracts/src/OracleX.sol) — `receiveSettlement()`, `requestSettlement()`

### Track 3: Best Use of World ID with CRE

- Before creating a market, users must verify with **World ID** (proof of unique humanness)
- Prevents spam market creation and wash trading
- World ID verification via MiniKit's `verify()` — proof validated before on-chain transaction
- CRE then resolves these World ID-gated markets via AI + consensus + on-chain settlement

**World ID files**: [`frontend/src/lib/worldid.ts`](frontend/src/lib/worldid.ts), [`frontend/src/app/create/page.tsx`](frontend/src/app/create/page.tsx)

### Track 4: Best Usage of CRE within a World Mini App

OracleX runs as a **full-featured World Mini App**:
- **MiniKit SDK** — `walletAuth` for sign-in, `sendTransaction` for gas-free trading
- **World Chain mainnet (chain 480)** — all mini app transactions
- **CRE resolves World Chain markets** — `world-resolver` workflow listens for events on World Chain
- **No approvals needed** — custom `MockUSDCWorld` with OracleX as trusted operator
- **Dual-chain architecture** — same frontend serves web (Sepolia) and mini app (World Chain)

**Mini App files**:
- MiniKit: [`frontend/src/components/MiniKitProvider.tsx`](frontend/src/components/MiniKitProvider.tsx), [`frontend/src/lib/minikit-wallet.ts`](frontend/src/lib/minikit-wallet.ts)
- World Chain: [`frontend/src/lib/worldchain.ts`](frontend/src/lib/worldchain.ts)
- Trading: [`frontend/src/components/TradePanel.tsx`](frontend/src/components/TradePanel.tsx) (`handleWorldChainBuy`, `handleWorldChainSell`)
- CRE workflow: [`cre-workflow/workflows/world-resolver/main.ts`](cre-workflow/workflows/world-resolver/main.ts)
- Token: [`contracts/src/MockUSDCWorld.sol`](contracts/src/MockUSDCWorld.sol)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.20, OpenZeppelin, Hardhat |
| Oracle | Chainlink CRE (EVM log trigger + HTTPClient + EVMClient + consensusIdenticalAggregation) |
| AI | Groq llama-3.3-70b-versatile (free tier, 14,400 req/day) |
| Data Sources | CoinGecko (crypto), The Odds API (sports), NewsAPI (news) |
| Frontend | Next.js 15, thirdweb v5, MiniKit SDK, Framer Motion, Tailwind CSS v4 |
| Backend | Node.js, Express, Socket.io, Prisma ORM, Supabase (PostgreSQL) |
| Chains | Ethereum Sepolia (web app), World Chain mainnet 480 (mini app) |
| Identity | World ID via MiniKit (sybil resistance for market creation) |
| Fonts/Design | Custom Brice font family, retro Orbit-inspired UI |

---

## Repo Structure

```
oraclex/
├── contracts/                       # Hardhat project — Solidity contracts
│   ├── src/
│   │   ├── OracleX.sol                   # Main prediction market contract
│   │   ├── MockUSDC.sol                  # Test USDC (Sepolia)
│   │   └── MockUSDCWorld.sol             # Auto-approve USDC (World Chain)
│   ├── scripts/
│   │   ├── deploy.ts                     # Sepolia deployment
│   │   └── deploy-world.ts              # World Chain deployment
│   ├── hardhat.config.ts                 # Sepolia + World Chain networks
│   └── .env.example                      # Required env vars
│
├── cre-workflow/                    # Chainlink CRE workflows
│   ├── workflows/
│   │   ├── market-resolver/              # Sepolia resolver
│   │   │   ├── main.ts                   # CRE workflow: trigger → AI → settlement
│   │   │   └── workflow.yaml             # EVM log trigger config (ethereum-sepolia)
│   │   └── world-resolver/               # World Chain resolver
│   │       ├── main.ts                   # Same AI logic, targets World Chain
│   │       └── workflow.yaml             # EVM log trigger config (ethereum-mainnet-worldchain-1)
│   └── abis/OracleX.json
│
├── backend/                         # Node.js API + dual-chain event indexer
│   ├── prisma/schema.prisma             # Market, Trade, IndexerState models
│   ├── src/
│   │   ├── index.ts                      # Express + Socket.io + dual indexer startup
│   │   ├── indexer.ts                    # viem event watcher (Sepolia + World Chain)
│   │   └── api/
│   │       ├── markets.ts                # GET /markets?chain=sepolia|worldchain
│   │       ├── positions.ts              # GET /positions/:address, /leaderboard
│   │       └── ai.ts                     # POST /ai/generate-market (Groq)
│   └── .env.example                      # Required env vars
│
├── frontend/                        # Next.js 15 — serves web + World Mini App
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                  # Landing: wallet connect (web) / walletAuth (mini app)
│   │   │   ├── home/                     # Swipeable market cards (Tinder-style)
│   │   │   ├── markets/                  # Market list with filter tabs
│   │   │   ├── markets/[id]/             # Market detail + trade panel
│   │   │   ├── create/                   # Create market wizard + AI auto-fill + World ID
│   │   │   ├── holdings/                 # User positions (chain-aware, MiniKit-aware)
│   │   │   ├── account/                  # Profile + stats + wallet management
│   │   │   └── leaderboard/              # Top traders by volume
│   │   ├── components/
│   │   │   ├── MiniKitProvider.tsx        # World App MiniKit initialization
│   │   │   ├── TradePanel.tsx            # Buy/sell panel (thirdweb or MiniKit)
│   │   │   ├── BottomNav.tsx             # Mobile navigation bar
│   │   │   └── AuthGuard.tsx             # Wallet session guard
│   │   ├── lib/
│   │   │   ├── thirdweb.ts               # thirdweb client + chain config
│   │   │   ├── worldchain.ts             # World Chain addresses + constants
│   │   │   ├── worldid.ts                # World ID verification helpers
│   │   │   ├── minikit-wallet.ts         # MiniKit wallet address persistence
│   │   │   └── api.ts                    # Backend fetch helper
│   │   ├── hooks/
│   │   │   └── useMarkets.ts             # Chain-aware contract read hooks
│   │   └── abis/
│   │       └── OracleX.ts                # Contract ABIs (OracleX + USDC)
│   └── .env.example                      # Required env vars
│
├── SUBMISSION.md                    # Hackathon submission answers
└── DEMO-SCRIPT.md                   # Demo video recording script
```

---

## Local Setup

### Prerequisites

- **Node.js** v18+ (v20 recommended)
- **pnpm** — `npm install -g pnpm`
- A **Supabase** account (free tier) for PostgreSQL — [supabase.com](https://supabase.com)
- A **thirdweb** account for client ID — [thirdweb.com](https://thirdweb.com)
- A **Groq** API key (free) — [console.groq.com](https://console.groq.com)
- **ngrok** (for testing mini app locally) — [ngrok.com](https://ngrok.com)
- **World App** on your phone (for mini app testing)
- **Foundry** (`cast`) for manual contract interactions — [getfoundry.sh](https://getfoundry.sh)

### 1. Smart Contracts

```bash
cd contracts
cp .env.example .env
# Fill PRIVATE_KEY (deployer wallet with Sepolia ETH + World Chain ETH)
pnpm install
```

**Deploy to Sepolia (web app):**
```bash
pnpm exec hardhat run scripts/deploy.ts --network sepolia
```

**Deploy to World Chain mainnet (mini app):**
```bash
pnpm exec hardhat run scripts/deploy-world.ts --network worldchain
```

Save the deployed contract addresses — you'll need them for backend and frontend `.env` files.

**Mint test USDC (World Chain):**
```bash
# Mint 10,000 MockUSDCWorld to your wallet
cast send <MOCK_USDC_WORLD_ADDRESS> "faucet()" \
  --rpc-url https://worldchain-mainnet.g.alchemy.com/public \
  --private-key <YOUR_PRIVATE_KEY>
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill all values (see .env.example for descriptions)
pnpm install
pnpm exec prisma generate
pnpm exec prisma db push
pnpm dev    # → http://localhost:4000
```

**For World Mini App testing, expose via ngrok:**
```bash
ngrok http 4000
# Copy the https://xxxx.ngrok-free.dev URL → set as NEXT_PUBLIC_BACKEND_URL in frontend
```

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/markets?chain=worldchain` | List all markets (filter by chain) |
| GET | `/markets/:id?chain=worldchain` | Single market details |
| GET | `/positions/:address?chain=worldchain` | User's positions |
| GET | `/positions/leaderboard/all` | Top traders |
| POST | `/ai/generate-market` | AI-generated market suggestions |
| POST | `/verify/worldid` | Verify World ID proof |
| GET | `/health` | Healthcheck |

**Socket.io Events:** `marketCreated`, `positionTaken`, `positionSold`, `marketSettled`

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# Fill all values (see .env.example for descriptions)
pnpm install
pnpm dev    # → http://localhost:3000
```

**For World Mini App testing:**
1. Deploy to Vercel: `vercel --prod`
2. Or use ngrok: `ngrok http 3000` and set the URL in World Developer Portal

### 4. World Mini App Configuration

1. Go to [World Developer Portal](https://developer.worldcoin.org)
2. Create a new Mini App → get your `app_id`
3. **Important settings in the portal:**
   - **App URL**: Your deployed frontend URL (Vercel or ngrok)
   - **Contract Entrypoints**: Add BOTH contract addresses:
     - OracleX: `0x266BD36ae57d7803C689A34a97dfE85469295E74`
     - MockUSDCWorld: `0x096523b93CeDd2f223A4DB03A6D7B108A18B6224`
   - **Permit2 Tokens**: Add MockUSDCWorld address
   - **Verification Actions**: Create actions `oraclexbet` and `oraclexcreatemarket`
4. Set `NEXT_PUBLIC_WLD_APP_ID` in your frontend `.env.local`
5. Open World App → Developer Tools → test your mini app

### 5. CRE Workflow

```bash
# Install CRE CLI
# Download from: https://github.com/smartcontractkit/cre-cli/releases
# Extract and add to PATH

cre login
cre account access    # Request deploy access (Early Access program)

# Sepolia workflow
cd cre-workflow/workflows/market-resolver
pnpm install

# Upload secrets
export GROQ_API_KEY=<your_key>
cre secrets upload --workflow oraclex-market-resolver

# Simulate locally
cre simulation run --non-interactive --verbose

# Deploy (requires deploy access)
cre workflow deploy .

# World Chain workflow
cd ../world-resolver
pnpm install
cre workflow deploy .
```

After deploying, the CRE DON provides a **forwarder address**. Set it on the contract:
```bash
cast send <ORACLEX_ADDRESS> "setCreForwarder(address)" <FORWARDER_ADDRESS> \
  --rpc-url <RPC_URL> --private-key <PRIVATE_KEY>
```

**Manual settlement (without CRE DON):**

If CRE DON is not deployed, you can simulate the settlement flow manually:

```bash
# Step 1: Call AI to get the outcome
curl -s https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer <GROQ_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.3-70b-versatile",
    "messages": [
      {"role": "system", "content": "You are a precise prediction market oracle. Reply only with valid JSON."},
      {"role": "user", "content": "MARKET QUESTION: <PASTE QUESTION>\nCURRENT DATE: 2026-03-09\n\nRespond with ONLY valid JSON:\n{\"outcome\":\"YES\",\"confidence_bps\":9200,\"reasoning\":\"...\"}\n\nRules:\n- outcome: YES | NO | INVALID\n- confidence_bps: 0-10000 (must be >= 8000)\n- reasoning: max 300 chars"}
    ],
    "temperature": 0.1,
    "max_tokens": 256,
    "response_format": {"type": "json_object"}
  }'

# Step 2: Settle on-chain (OUTCOME: 1=YES, 2=NO, 3=INVALID)
cast send <ORACLEX_ADDRESS> \
  "receiveSettlement(uint256,uint8,uint256,string)" \
  <MARKET_ID> <OUTCOME> <CONFIDENCE_BPS> "<AI_REASONING>" \
  --rpc-url <RPC_URL> --private-key <PRIVATE_KEY>
```

---

## Deployed Contracts

### World Chain Mainnet (Mini App) — Primary

| Contract | Address |
|----------|---------|
| OracleX | `0x266BD36ae57d7803C689A34a97dfE85469295E74` |
| MockUSDCWorld | `0x096523b93CeDd2f223A4DB03A6D7B108A18B6224` |

### Ethereum Sepolia (Web App)

| Contract | Address |
|----------|---------|
| OracleX | `0x9eE8B1E0A915A8EE1c0864F96695d54E7cDEd5d2` |
| MockUSDC | `0x096523b93CeDd2f223A4DB03A6D7B108A18B6224` |

---

## Files Using Chainlink

| File | Chainlink Usage |
|------|----------------|
| [`cre-workflow/workflows/market-resolver/main.ts`](cre-workflow/workflows/market-resolver/main.ts) | Full CRE workflow: `EVMClient.callContract`, `HTTPClient.sendRequest`, `handler`, `consensusIdenticalAggregation`, `EVMClient.writeReport`, `runtime.report`, `runtime.getSecret`, `runtime.runInNodeMode` |
| [`cre-workflow/workflows/market-resolver/workflow.yaml`](cre-workflow/workflows/market-resolver/workflow.yaml) | CRE config: `evm-log` trigger on Ethereum Sepolia |
| [`cre-workflow/workflows/world-resolver/main.ts`](cre-workflow/workflows/world-resolver/main.ts) | Same CRE capabilities targeting World Chain (chain selector `ethereum-mainnet-worldchain-1`) |
| [`cre-workflow/workflows/world-resolver/workflow.yaml`](cre-workflow/workflows/world-resolver/workflow.yaml) | CRE config: `evm-log` trigger on World Chain mainnet |
| [`contracts/src/OracleX.sol`](contracts/src/OracleX.sol) | `receiveSettlement()` — CRE forwarder-gated settlement function, `requestSettlement()` — emits the event that triggers CRE |

---

