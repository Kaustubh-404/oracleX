# OracleX — AI-Powered Prediction Markets via Chainlink CRE

> Chainlink Convergence Hackathon 2026 submission

OracleX is a fully on-chain prediction market where **every outcome is resolved by AI**
running inside the Chainlink Runtime Environment (CRE). No governance tokens. No manual
resolution. No manipulation.

---

## Architecture

```
User (browser)
  │  buy YES / NO (USDC)
  ▼
OracleX.sol  ──── requestSettlement() ────► SettlementRequested event
  │                                              │
  │                                    Chainlink CRE DON
  │                                         (EVM log trigger)
  │                                              │
  │                                    Per-node (x5 nodes):
  │                                      • callContract → read market
  │                                      • HTTPClient → CoinGecko / Odds / NewsAPI
  │                                      • Groq AI llama-3.3-70b → outcome + confidence
  │                                              │
  │                              consensusIdenticalAggregation
  │                                 (all nodes must agree)
  │                                              │
  │                          runtime.report() + EVMClient.writeReport()
  │                                              │
  ◄───────────── receiveSettlement(outcome, confidenceBps, reasoning) ─────────
  │
  claimWinnings() → proportional USDC payout
```

---

## Stack

| Layer       | Technology                                                   |
|-------------|--------------------------------------------------------------|
| Smart contracts | Solidity 0.8.20, Hardhat + thirdweb deploy              |
| Oracle      | Chainlink CRE (EVM log trigger + HTTPClient + EVMClient)     |
| AI          | Groq llama-3.3-70b-versatile (free, 14 400 req/day)          |
| Data        | CoinGecko, The Odds API, NewsAPI, GDELT                      |
| Frontend    | Next.js 15, thirdweb v5, Recharts, Tailwind CSS              |
| Backend     | Node.js, Express, Socket.io, Prisma, Supabase (PostgreSQL)   |
| Testnet     | Ethereum Sepolia                                             |

---

## Repo Structure

```
oraclex/
├── contracts/          # Hardhat project
│   ├── src/
│   │   ├── OracleX.sol       # Main prediction market contract
│   │   └── MockUSDC.sol      # Test collateral token
│   ├── scripts/deploy.ts
│   └── test/OracleX.test.ts
│
├── cre-workflow/       # Chainlink CRE workflow
│   └── workflows/market-resolver/
│       ├── main.ts           # CRE workflow (trigger → AI → on-chain)
│       ├── workflow.yaml     # Trigger + capabilities config
│       └── secrets.yaml      # Secret declarations
│
├── backend/            # Node.js API + indexer (pnpm)
│   ├── prisma/schema.prisma      # Supabase schema (Market, Trade, IndexerState)
│   └── src/
│       ├── index.ts              # Express + Socket.io server
│       ├── indexer.ts            # viem event indexer (live + catch-up)
│       ├── db.ts                 # Prisma client
│       └── api/
│           ├── markets.ts        # GET /markets, /markets/:id, /markets/:id/trades
│           ├── positions.ts      # GET /positions/:address, /leaderboard
│           └── ai.ts             # POST /ai/generate-market (Groq)
│
└── frontend/web/       # Next.js app (pnpm)
    └── src/
        ├── app/
        │   ├── page.tsx          # Market list
        │   ├── markets/[id]/     # Market detail + trade panel + live WS
        │   ├── create/           # Create market wizard + AI auto-fill
        │   ├── portfolio/        # User positions
        │   ├── leaderboard/      # Top traders by volume
        │   └── profile/[addr]/   # Wallet stats + trade history
        ├── components/
        │   ├── MarketCard.tsx
        │   ├── TradePanel.tsx
        │   └── ProbabilityChart.tsx
        └── hooks/
            ├── useMarkets.ts     # thirdweb contract hooks
            └── useSocket.ts      # Socket.io live price hook
```

---

## Quick Start

### 1. Deploy Contracts (Sepolia)

**Option A — thirdweb deploy (recommended, required for partner prize)**

```bash
cd contracts
pnpm install
pnpm exec hardhat compile       # Compile so thirdweb can find artifacts

# Deploy MockUSDC (no constructor args)
npx thirdweb deploy             # Opens browser → select MockUSDC → deploy on Sepolia
                                # Copy the deployed MockUSDC address

# Deploy OracleX (_creForwarder = your own wallet address for hackathon demo)
npx thirdweb deploy             # Opens browser → select OracleX → paste wallet addr → deploy
```

`thirdweb deploy` opens `app.thirdweb.com/deployer` in your browser. Connect your wallet
there — no private key ever touches the filesystem. It also auto-verifies on Etherscan.

**Option B — Hardhat (fallback, also seeds a demo market)**

```bash
cd contracts
cp .env.example .env            # Fill in PRIVATE_KEY, ALCHEMY_KEY, ETHERSCAN_KEY
pnpm exec hardhat run scripts/deploy.ts --network sepolia
```

After deploying (either method), copy the contract addresses into `cre-workflow/.env`
and `frontend/web/.env.local`.

**Seed a demo market** (after deploy, if you used Option A):

```bash
# Via the frontend: connect wallet → /create → fill in a market
# Or via the contract's createMarket() on Etherscan (contract is verified)
```

### 2. Configure the CRE Workflow

```bash
cd cre-workflow
cp .env.example .env          # Fill in CONTRACT_ADDRESS, GROQ_API_KEY, etc.

# Update workflow.yaml with the deployed contract address and event topic:
#   cast keccak "SettlementRequested(uint256,string,uint256)"

# Set secrets
cre secrets set GROQ_API_KEY <your_key>
cre secrets set NEWS_API_KEY <your_key>    # optional
cre secrets set ODDS_API_KEY <your_key>   # optional (sports markets)

# Test locally
cre simulation run workflows/market-resolver/workflow.yaml

# Deploy to DON
cre deploy workflows/market-resolver/workflow.yaml
```

### 3. Start the Backend

```bash
cd backend
# .env is already pre-filled with Supabase URL
# Fill in: RPC_URL, ORACLEX_ADDRESS, USDC_ADDRESS, GROQ_API_KEY
pnpm install
pnpm exec prisma generate        # Generate Prisma client types
pnpm dev                          # → http://localhost:4000
```

The backend:
- Serves REST API at `/markets`, `/positions/:address`, `/positions/leaderboard/all`, `/ai/generate-market`
- Indexes on-chain events into Supabase via viem's `watchContractEvent`
- Broadcasts live trade/settlement updates over Socket.io

### 4. Start the Frontend

```bash
cd frontend/web
cp .env.example .env.local    # Fill in thirdweb client ID + contract addresses + backend URL
pnpm install
pnpm dev                       # → http://localhost:3000
```

---

## How Resolution Works

1. Any user calls `requestSettlement(marketId)` after the market's closing time.
2. The contract emits `SettlementRequested(marketId, question, timestamp)`.
3. The CRE EVM-log trigger fires on all 5 DON nodes simultaneously.
4. Each node:
   - Reads the market question and category from the contract
   - Fetches real-world data from 1-3 external APIs
   - Calls **Groq llama-3.3-70b** with a structured prompt
   - Returns `{ outcome, confidenceBps, reasoning }`
5. `consensusIdenticalAggregation` requires **all nodes to agree** on the exact response.
6. If confidence < 80%, the market resolves as **INVALID** — all positions refunded.
7. The DON writes the settlement on-chain via `EVMClient.writeReport()`, which calls
   `receiveSettlement()` through the Chainlink forwarder.

---

## Hackathon Tracks

- 🥇 **Prediction Markets** — $16k / $10k / $6k
- 🥇 **CRE & AI** — $17k / $10.5k / $6.5k
- 🎁 **thirdweb × CRE** — bonus partner prize

Total prize eligibility: **~$36,500**

---

## License

MIT
