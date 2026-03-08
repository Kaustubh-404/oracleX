# OracleX — AI-Powered Prediction Markets via Chainlink CRE

> **Chainlink Convergence Hackathon 2026** | Tracks: Prediction Markets, CRE & AI, Best use of World ID with CRE, Best usage of CRE within a World Mini App

OracleX is a fully on-chain prediction market platform where **every outcome is resolved by AI running inside the Chainlink Runtime Environment (CRE)**. No governance tokens. No manual resolution. No manipulation. Available as both a **web app (Ethereum Sepolia)** and a **World Mini App (World Chain mainnet)** — two frontends, one codebase, one AI oracle.

---

## What Makes OracleX Different

| Traditional Prediction Markets | OracleX |
|-------------------------------|---------|
| Outcomes resolved by governance vote or manual admin | **AI resolves every market** — Groq llama-3.3-70b reads real-world data and decides |
| Single oracle / centralized resolution | **Chainlink CRE DON** — 5+ nodes must reach identical consensus |
| Low confidence = wrong answer forced | **Confidence threshold** — below 80% → market INVALID, everyone refunded |
| Web-only, wallet-connect friction | **World Mini App** — open in World App, gas-free transactions, 1-tap trading |
| Single chain | **Multi-chain** — Ethereum Sepolia (web) + World Chain mainnet (mini app) |
| No sybil resistance | **World ID integration** — proof of unique humanness before creating markets |

---

## Live Demo

- **Web App**: Connect any wallet on Sepolia → browse, create, and trade prediction markets
- **World Mini App**: Open inside World App → gas-free trading on World Chain with World ID verification
- **Backend API**: Real-time event indexing + Socket.io live updates across both chains

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OracleX Platform                            │
├──────────────────────┬──────────────────────────────────────────────┤
│   Web App (Sepolia)  │          World Mini App (World Chain)        │
│   thirdweb v5 wallet │          MiniKit SDK · gas-free txs          │
│   MetaMask/WC/etc    │          World ID verification               │
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
│  3. Per-node execution (5 nodes):                                    │
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
    Market settled on Sepolia      Market settled on World Chain
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

## Hackathon Track Alignment

### Track 1: Prediction Markets 

OracleX is a **decentralized prediction market** with automated, verifiable settlement:

- Users create yes/no markets on any topic (crypto, sports, tech, news)
- USDC-denominated positions with CPMM pricing (constant-product market maker)
- **AI-powered settlement** — Groq llama-3.3-70b analyzes real-world data sources
- **Confidence gating** — below 80% confidence → INVALID outcome → full refunds
- Multi-source data: CoinGecko (crypto), The Odds API (sports), NewsAPI (news)

**Chainlink files**: [`cre-workflow/workflows/market-resolver/main.ts`](cre-workflow/workflows/market-resolver/main.ts), [`contracts/src/OracleX.sol`](contracts/src/OracleX.sol)

### Track 2: CRE & AI 
The CRE workflow is the **core orchestration layer** — AI doesn't just assist, it *is* the oracle:

- **EVM log trigger** → detects `SettlementRequested` on-chain events
- **EVMClient.callContract()** → reads market details from the blockchain
- **HTTPClient** → fetches real-time data from 3 external APIs (CoinGecko, Odds API, NewsAPI)
- **Groq AI (llama-3.3-70b)** → structured JSON prompt with market question + external data → returns `{outcome, confidence_bps, reasoning}`
- **consensusIdenticalAggregation** → all DON nodes must produce identical AI results (BFT consensus)
- **EVMClient.writeReport()** → writes the verified AI decision on-chain

The AI is not a suggestion engine — it's the **final arbiter** that decides market outcomes, with confidence thresholds ensuring quality. CRE provides the decentralized execution, consensus, and on-chain delivery.

**Chainlink files**:
- Sepolia workflow: [`cre-workflow/workflows/market-resolver/main.ts`](cre-workflow/workflows/market-resolver/main.ts), [`cre-workflow/workflows/market-resolver/workflow.yaml`](cre-workflow/workflows/market-resolver/workflow.yaml)
- World Chain workflow: [`cre-workflow/workflows/world-resolver/main.ts`](cre-workflow/workflows/world-resolver/main.ts), [`cre-workflow/workflows/world-resolver/workflow.yaml`](cre-workflow/workflows/world-resolver/workflow.yaml)
- Contract (settlement receiver): [`contracts/src/OracleX.sol`](contracts/src/OracleX.sol) — `receiveSettlement()`, `requestSettlement()`

### Track 3: Best Use of World ID with CRE

OracleX integrates **World ID for sybil-resistant market creation** inside the World Mini App:

- Before creating a market, users must verify with **World ID** (proof of unique humanness)
- This prevents spam market creation and wash trading
- World ID verification happens client-side via MiniKit's `walletAuth` — the proof is verified before any on-chain transaction
- The CRE workflow then resolves these World ID-gated markets the same way — AI + consensus + on-chain settlement

**World ID files**: [`frontend/src/lib/worldid.ts`](frontend/src/lib/worldid.ts), [`frontend/src/app/create/page.tsx`](frontend/src/app/create/page.tsx) (verification gate before `handleWorldChainCreate`)

### Track 4: Best Usage of CRE within a World Mini App

OracleX runs as a **full-featured World Mini App**:

- **MiniKit SDK integration** — `walletAuth` for sign-in, `sendTransaction` for gas-free trading
- **World Chain mainnet (chain 480)** — all mini app transactions land on World Chain
- **CRE resolves World Chain markets** — the `world-resolver` workflow listens for `SettlementRequested` events on World Chain and settles via AI
- **No approvals needed** — custom `MockUSDCWorld` token with OracleX as trusted operator (World App blocks `approve()` calls by default)
- **Dual-chain architecture** — the same frontend serves both web (Sepolia + thirdweb wallet) and mini app (World Chain + MiniKit), with chain-aware routing

This is a **cross-chain mini app** — World App only supports World Chain natively, but CRE brings external data (CoinGecko, NewsAPI, Odds API) and AI (Groq) into the World Chain ecosystem for market resolution.

**Mini App files**:
- MiniKit integration: [`frontend/src/components/MiniKitProvider.tsx`](frontend/src/components/MiniKitProvider.tsx), [`frontend/src/lib/minikit-wallet.ts`](frontend/src/lib/minikit-wallet.ts)
- World Chain config: [`frontend/src/lib/worldchain.ts`](frontend/src/lib/worldchain.ts)
- Gas-free transactions: [`frontend/src/app/create/page.tsx`](frontend/src/app/create/page.tsx) (`handleWorldChainCreate`), [`frontend/src/components/TradePanel.tsx`](frontend/src/components/TradePanel.tsx) (`handleWorldChainBuy`)
- World Chain CRE workflow: [`cre-workflow/workflows/world-resolver/main.ts`](cre-workflow/workflows/world-resolver/main.ts)
- Auto-approve token: [`contracts/src/MockUSDCWorld.sol`](contracts/src/MockUSDCWorld.sol)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.20, OpenZeppelin, Hardhat |
| Oracle | Chainlink CRE (EVM log trigger + HTTPClient + EVMClient) |
| AI | Groq llama-3.3-70b-versatile (free tier, 14,400 req/day) |
| Data Sources | CoinGecko (crypto), The Odds API (sports), NewsAPI (news) |
| Frontend | Next.js 15, thirdweb v5, MiniKit SDK, Framer Motion, Tailwind CSS |
| Backend | Node.js, Express, Socket.io, Prisma ORM, Supabase (PostgreSQL) |
| Chains | Ethereum Sepolia (web app), World Chain mainnet 480 (mini app) |
| Identity | World ID (sybil resistance for market creation) |

---

## Repo Structure

```
oraclex/
├── contracts/                    # Hardhat project — both chains
│   ├── src/
│   │   ├── OracleX.sol                # Main prediction market contract
│   │   ├── MockUSDC.sol               # Test USDC (Sepolia)
│   │   └── MockUSDCWorld.sol          # Auto-approve USDC (World Chain)
│   ├── scripts/
│   │   ├── deploy.ts                  # Sepolia deployment
│   │   └── deploy-world.ts           # World Chain deployment
│   └── hardhat.config.ts              # Sepolia + World Chain networks
│
├── cre-workflow/                 # Chainlink CRE workflows
│   ├── workflows/
│   │   ├── market-resolver/           # Sepolia resolver
│   │   │   ├── main.ts               # CRE workflow: trigger → AI → settlement
│   │   │   └── workflow.yaml         # EVM log trigger config (ethereum-sepolia)
│   │   └── world-resolver/            # World Chain resolver
│   │       ├── main.ts               # Same AI logic, targets World Chain
│   │       └── workflow.yaml         # EVM log trigger config (ethereum-mainnet-worldchain-1)
│   └── abis/OracleX.json
│
├── backend/                      # Node.js API + dual-chain indexer
│   ├── prisma/schema.prisma          # Market, Trade, IndexerState models
│   └── src/
│       ├── index.ts                   # Express + Socket.io + dual indexer startup
│       ├── indexer.ts                 # viem event watcher (Sepolia + World Chain)
│       └── api/
│           ├── markets.ts             # GET /markets?chain=sepolia|worldchain
│           ├── positions.ts           # GET /positions/:address, /leaderboard
│           └── ai.ts                  # POST /ai/generate-market (Groq)
│
└── frontend/                     # Next.js 15 — serves web + mini app
    └── src/
        ├── app/
        │   ├── page.tsx               # Landing: wallet connect (web) / walletAuth (mini app)
        │   ├── home/                  # Swipeable market cards (Tinder-style)
        │   ├── markets/               # Market list with filter tabs
        │   ├── markets/[id]/          # Market detail + trade panel
        │   ├── create/                # Create market wizard + AI auto-fill + World ID gate
        │   ├── holdings/              # User positions (chain-aware)
        │   ├── account/               # Profile + stats + wallet management
        │   └── leaderboard/           # Top traders by volume
        ├── components/
        │   ├── MiniKitProvider.tsx     # World App MiniKit initialization
        │   ├── TradePanel.tsx         # Buy/sell panel (thirdweb or MiniKit)
        │   ├── BottomNav.tsx          # Mobile navigation bar
        │   └── AuthGuard.tsx          # Wallet session guard
        ├── lib/
        │   ├── thirdweb.ts            # thirdweb client + chain config
        │   ├── worldchain.ts          # World Chain addresses + constants
        │   ├── worldid.ts             # World ID verification helpers
        │   ├── minikit-wallet.ts      # MiniKit wallet address persistence
        │   └── api.ts                 # Backend fetch helper
        ├── hooks/
        │   └── useMarkets.ts          # Chain-aware contract read hooks
        └── abis/
            └── OracleX.ts             # Contract ABIs
```

---

## Deployed Contracts

### Ethereum Sepolia (Web App)

| Contract | Address |
|----------|---------|
| OracleX | `0x9eE8B1E0A915A8EE1c0864F96695d54E7cDEd5d2` |
| MockUSDC | `0x096523b93CeDd2f223A4DB03A6D7B108A18B6224` |

### World Chain Mainnet (Mini App)

| Contract | Address |
|----------|---------|
| OracleX | `0x266BD36ae57d7803C689A34a97dfE85469295E74` |
| MockUSDCWorld | `0x096523b93CeDd2f223A4DB03A6D7B108A18B6224` |

---

## Quick Start

### 1. Deploy Contracts

**Sepolia (web app):**
```bash
cd contracts
cp .env.example .env    # Fill PRIVATE_KEY
pnpm install
pnpm exec hardhat run scripts/deploy.ts --network sepolia
```

**World Chain (mini app):**
```bash
pnpm exec hardhat run scripts/deploy-world.ts --network worldchain
```

### 2. Configure & Test CRE Workflows

```bash
cd cre-workflow/workflows/market-resolver
pnpm install

# Set secrets
export GROQ_API_KEY=<your_key>
cre secrets upload --workflow oraclex-market-resolver

# Simulate (Sepolia)
cre simulation run --non-interactive --verbose

# World Chain workflow
cd ../world-resolver
pnpm install
cre simulation run --non-interactive --verbose
```

### 3. Start Backend

```bash
cd backend
# Fill .env: DATABASE_URL, RPC_URL, ORACLEX_ADDRESS, WORLD_CHAIN_RPC_URL, etc.
pnpm install
pnpm exec prisma generate
pnpm exec prisma db push
pnpm dev    # → http://localhost:4000
```

### 4. Start Frontend

```bash
cd frontend
# Fill .env.local: NEXT_PUBLIC_THIRDWEB_CLIENT_ID, contract addresses, backend URL
pnpm install
pnpm dev    # → http://localhost:3000
```

### 5. World Mini App Setup

1. Register at [World Developer Portal](https://developer.worldcoin.org)
2. Create a Mini App → get `app_id`
3. Add **Contract Entrypoints**: OracleX + MockUSDCWorld addresses
4. Add **Permit2 Tokens**: MockUSDCWorld address
5. Set `NEXT_PUBLIC_WLD_APP_ID` in `.env.local`
6. Deploy frontend to Vercel → set the URL as your mini app URL

---

## How Resolution Works

1. Any user calls `requestSettlement(marketId)` after the market's closing time.
2. The contract emits `SettlementRequested(marketId, question, timestamp)`.
3. The CRE EVM-log trigger fires on all DON nodes simultaneously.
4. Each node:
   - Reads the market question and category from the contract via `EVMClient.callContract()`
   - Fetches real-world data from 1–3 external APIs via `HTTPClient.sendRequest()`
   - Calls **Groq llama-3.3-70b** with a structured prompt → `{ outcome, confidence_bps, reasoning }`
5. `consensusIdenticalAggregation` requires **all nodes to agree** on the exact AI response.
6. If confidence < 80%, the market resolves as **INVALID** — all positions are refunded.
7. The DON writes the settlement on-chain via `EVMClient.writeReport()` → `receiveSettlement()`.

This works identically on both Sepolia and World Chain — two CRE workflows, same AI logic, different chain targets.

---

## World Mini App Details

### Why a Mini App?

World App has **10M+ verified humans**. By building OracleX as a Mini App, users can:
- Trade prediction markets with **zero gas fees** (World Chain subsidizes gas)
- Create markets with **World ID sybil resistance** (one human = one identity)
- Use familiar in-app UX — no wallet setup, no MetaMask popups

### Technical Challenges Solved

| Challenge | Solution |
|-----------|----------|
| World App blocks `approve()` calls | Deployed `MockUSDCWorld` with OracleX as trusted operator — `transferFrom` works without approval |
| MiniKit only works on World Chain mainnet | Dual-chain architecture — separate contracts + CRE workflows per chain |
| No sequential tx execution guarantee | Single-transaction flows — no approve+action batches |
| `sendTransaction` returns app-level ID, not tx hash | Backend indexer watches on-chain events for confirmation |
| MiniKit not installed warnings in browser | `isMiniApp()` guard — graceful degradation to thirdweb wallet |

---

## Files Using Chainlink

| File | Chainlink Usage |
|------|----------------|
| [`cre-workflow/workflows/market-resolver/main.ts`](cre-workflow/workflows/market-resolver/main.ts) | CRE workflow: EVMClient, HTTPClient, handler, consensusIdenticalAggregation, writeReport |
| [`cre-workflow/workflows/market-resolver/workflow.yaml`](cre-workflow/workflows/market-resolver/workflow.yaml) | CRE config: evm-log trigger on Sepolia |
| [`cre-workflow/workflows/world-resolver/main.ts`](cre-workflow/workflows/world-resolver/main.ts) | CRE workflow: same capabilities, targeting World Chain |
| [`cre-workflow/workflows/world-resolver/workflow.yaml`](cre-workflow/workflows/world-resolver/workflow.yaml) | CRE config: evm-log trigger on World Chain (ethereum-mainnet-worldchain-1) |
| [`contracts/src/OracleX.sol`](contracts/src/OracleX.sol) | `receiveSettlement()` — CRE forwarder-gated settlement, `requestSettlement()` — emits trigger event |

---

## License

MIT
