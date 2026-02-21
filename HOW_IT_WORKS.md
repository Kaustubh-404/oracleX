# OracleX — How It All Works

> A complete guide to the math, mechanics, and architecture behind OracleX prediction markets.

---

## Table of Contents

1. [What Is a Prediction Market?](#1-what-is-a-prediction-market)
2. [The Pool Model — Where Does the Money Go?](#2-the-pool-model)
3. [How Prices Work (The Math)](#3-how-prices-work)
4. [Buying a Position](#4-buying-a-position)
5. [Selling Early](#5-selling-early)
6. [How Settlement Works](#6-how-settlement-works)
7. [The Chainlink DON — Why It Can't Lie](#7-the-chainlink-don)
8. [AI Resolution — Step by Step](#8-ai-resolution)
9. [Claiming Winnings](#9-claiming-winnings)
10. [Fees](#10-fees)
11. [Edge Cases](#11-edge-cases)
12. [Contracts & Addresses](#12-contracts--addresses)

---

## 1. What Is a Prediction Market?

A prediction market lets people **bet on real-world outcomes** using money.

- If you think something will happen → buy **YES**
- If you think it won't → buy **NO**
- The market's YES% reflects **collective probability** — what everyone together thinks the odds are

**Example market:**
```
"Will ETH price be above $3,000 on March 1, 2026?"

YES: 58%  ████████████████████████░░░░░░░░░░░░  $58 in pool
NO:  42%  ░░░░░░░░░░░░░░░░░░░░░░░░████████████  $42 in pool
```

Unlike traditional betting, you're not playing against a house.
**You're playing against other people.**

---

## 2. The Pool Model

All USDC from buyers goes into **two pools** — YES and NO.

```
┌─────────────────────────────────────────────────────┐
│                   OracleX Contract                  │
│                                                     │
│   YES Pool          NO Pool        Total Pool       │
│  ┌─────────┐       ┌─────────┐    ┌─────────────┐  │
│  │  $58    │   +   │  $42    │  = │    $100     │  │
│  └─────────┘       └─────────┘    └─────────────┘  │
│                                                     │
│  All money stays locked here until market resolves  │
└─────────────────────────────────────────────────────┘
```

When the market resolves:
- **YES wins** → YES pool holders split the **entire** $100 total pool
- **NO wins** → NO pool holders split the **entire** $100 total pool
- **INVALID** → everyone gets their original money back

The protocol takes a **1% fee** on payouts (not on refunds).

---

## 3. How Prices Work

### The Price Formula

```
YES price (per share) = yesPool / totalPool
NO  price (per share) = noPool  / totalPool
```

With $58 YES and $42 NO:
```
YES price = $58 / $100 = $0.58 per share
NO  price = $42 / $100 = $0.42 per share
```

This price is also the **implied probability** — the market is saying there's a 58% chance ETH will be above $3k.

### How Prices Move

Every trade shifts the pools, which shifts the price:

```
Before:  YES=$58  NO=$42  →  YES=58%  NO=42%

Alice buys $20 YES:
After:   YES=$78  NO=$42  →  YES=65%  NO=35%
                                ↑ YES got more expensive
                                ↑ Market thinks it's more likely now

Bob buys $30 NO:
After:   YES=$78  NO=$72  →  YES=52%  NO=48%
                                ↓ YES got cheaper
                                ↓ Market now thinks it's closer to 50/50
```

**The price is always set by supply and demand. No oracle needed for pricing.**

---

## 4. Buying a Position

### The Math

When you buy YES for amount `A`:

```
Your ownership share = A / (yesPool + A)

If YES wins:
  Payout = your share × total pool
         = (A / newYesPool) × (yesPool + noPool + A)
```

### Full Example

```
Market state:  YES=$58  NO=$42  Total=$100

You buy YES for $10:
  New YES pool = $58 + $10 = $68
  New total    = $100 + $10 = $110
  Your share   = $10 / $68 = 14.7%

Scenario A — YES wins:
  Your payout  = 14.7% × $110 = $16.18
  Your profit  = $16.18 - $10 = +$6.18  🎉

Scenario B — NO wins:
  Your payout  = $0
  Your loss    = -$10          💸
```

### Potential Winnings at Different Prices

```
YES at 10% → buy $10 → win $100   (10x payout, risky)
YES at 25% → buy $10 → win $40    (4x payout)
YES at 50% → buy $10 → win $20    (2x payout)
YES at 75% → buy $10 → win $13.33 (1.33x payout, safer)
YES at 90% → buy $10 → win $11.11 (1.11x payout, very safe)
```

> **Rule of thumb:** The lower the probability, the bigger the payout if you're right.
> High probability = safe bet, low return. Low probability = risky bet, high return.

---

## 5. Selling Early

You don't have to wait for the market to close. You can **exit your position anytime** before closing time at the current market price.

### The Sell Formula

```
Proceeds = amount × (yourPool / totalPool)
         = amount × current price of your side
```

### Example

```
Market state: YES=$68  NO=$42  Total=$110
You own: $10 of YES position
Current YES price: $68 / $110 = 0.618

You sell your $10 position:
  Gross proceeds = $10 × 0.618 = $6.18
  Protocol fee   = $6.18 × 1%  = $0.06
  Net proceeds   = $6.18 - $0.06 = $6.12
```

### When Selling Makes Sense

```
You bought YES at 30% ($0.30/share)
YES is now at 70%    ($0.70/share)

You paid $10, your position is now worth:
  Sell proceeds = $10 × 0.70 = $7.00
  But you own MORE than $10 in shares because you bought cheap!

  Actual calculation:
    Shares owned = $10 / $0.30 = 33.3 shares
    Current value = 33.3 × $0.70 = $23.33 → PROFIT of $13.33
```

> **Selling early** locks in profit if prices moved in your favor,
> or limits loss if prices moved against you.
> The spread (difference between buy and sell price) stays in the pool
> for other participants.

---

## 6. How Settlement Works

### Step 1 — Market Closes

After the closing time, trading stops. The pools are frozen.

```
Timeline:
────────────────────────────────────────────────────►
  Create    Trading open         Close     Settle
  market    ←──────────────────►│         │
                                 │ Frozen  │ Resolution
```

### Step 2 — Anyone Triggers Settlement

Any user clicks **"Request AI Settlement →"** on the market page.

This calls `requestSettlement(marketId)` on the contract, which:
1. Marks `settlementRequested = true`
2. Emits the `SettlementRequested` event on-chain

```solidity
emit SettlementRequested(marketId, "Will ETH be above $3k?", timestamp);
```

**That's all the user does. Everything after this is automatic.**

### Step 3 — Chainlink CRE Takes Over

The DON is watching for exactly this event:

```
SettlementRequested event on-chain
            ↓
    Chainlink EVM Log Trigger fires
            ↓
   ┌────────────────────────┐
   │   5 DON nodes wake up  │
   │   simultaneously       │
   └────────────────────────┘
            ↓
   Each node runs the CRE workflow
   independently, in isolation
```

### Step 4 — Each Node Resolves

Every node independently:

```
┌─────────────────────────────────────────────────────┐
│  Node (runs 5 times independently)                  │
│                                                     │
│  1. Read market from contract                       │
│     callContract(getMarket(marketId))               │
│     → question, category, resolutionSource          │
│                                                     │
│  2. Fetch real-world data                           │
│     crypto  → CoinGecko API  (ETH/USD price)        │
│     sports  → The Odds API   (game scores)          │
│     news    → NewsAPI/GDELT  (event happened?)      │
│                                                     │
│  3. Ask Groq AI (llama-3.3-70b-versatile)           │
│     "Based on this data, resolve the market"        │
│     → { outcome, confidenceBps, reasoning }         │
│                                                     │
│  4. Return result to consensus layer                │
└─────────────────────────────────────────────────────┘
```

### Step 5 — Consensus (The Trust Engine)

```
Node 1 → { outcome: NO, confidence: 92%, reasoning: "ETH=$2,840" }
Node 2 → { outcome: NO, confidence: 92%, reasoning: "ETH=$2,840" }
Node 3 → { outcome: NO, confidence: 92%, reasoning: "ETH=$2,840" }
Node 4 → { outcome: NO, confidence: 91%, reasoning: "ETH=$2,840" }  ← different!
Node 5 → { outcome: NO, confidence: 92%, reasoning: "ETH=$2,840" }

consensusIdenticalAggregation → FAIL (nodes don't all agree)
Nodes retry...

Node 1 → { outcome: NO, confidence: 92%, reasoning: "ETH=$2,840" }
Node 2 → { outcome: NO, confidence: 92%, reasoning: "ETH=$2,840" }
Node 3 → { outcome: NO, confidence: 92%, reasoning: "ETH=$2,840" }
Node 4 → { outcome: NO, confidence: 92%, reasoning: "ETH=$2,840" }  ← now agrees
Node 5 → { outcome: NO, confidence: 92%, reasoning: "ETH=$2,840" }

consensusIdenticalAggregation → SUCCESS ✓
```

**ALL 5 nodes must return the exact same result.**
No single node can fake or manipulate the outcome.

### Step 6 — Written On-Chain

The DON writes the result through Chainlink's Forwarder contract:

```
Chainlink Forwarder → OracleX.receiveSettlement(
  marketId:      1,
  outcomeValue:  2,          // 1=YES, 2=NO, 3=INVALID
  confidenceBps: 9200,       // 92.00% confidence
  aiReasoning:   "ETH closed at $2,840 on CoinGecko at market close,
                  below the $3,000 threshold. NO resolves."
)
```

The contract checks:
```solidity
require(msg.sender == creForwarder, "Only CRE forwarder");
require(confidenceBps >= 8000,      "Min 80% confidence required");
```

If confidence < 80% → market resolves as **INVALID** (everyone refunded).

---

## 7. The Chainlink DON

### Why It Can't Lie

```
Traditional Oracle (single server):
  ┌──────────┐     can lie     ┌──────────┐
  │  Server  │ ─────────────► │ Contract │
  └──────────┘                └──────────┘
  One point of failure. One point of corruption.

Chainlink DON (5 independent nodes):
  ┌──────────┐ ─┐
  │  Node 1  │  │
  ├──────────┤  │  All must    ┌──────────┐
  │  Node 2  │  │  agree       │          │
  ├──────────┤  ├────────────► │ Contract │
  │  Node 3  │  │              │          │
  ├──────────┤  │              └──────────┘
  │  Node 4  │  │
  ├──────────┤  │
  │  Node 5  │ ─┘
  └──────────┘
  No single node controls the outcome.
  4 out of 5 nodes would need to be compromised simultaneously.
```

### The Forwarder Address

The contract only accepts settlements from one specific address — the Chainlink Forwarder:

```
OracleX.creForwarder = 0xE74686...  (currently your wallet for demo)
                     = 0xXXXXXX...  (Chainlink DON forwarder after cre deploy)
```

Upgrading is a single transaction — no redeployment:
```bash
cast send 0x9eE8B1E0A915A8EE1c0864F96695d54E7cDEd5d2 \
  "setCreForwarder(address)" 0xACTUAL_CRE_FORWARDER \
  --private-key YOUR_PRIVATE_KEY
```

After this, **only the DON can resolve markets**. Your wallet loses that power.

---

## 8. AI Resolution

### The Groq Prompt

Each node sends this to `llama-3.3-70b-versatile`:

```
System:
  You are an AI oracle resolving prediction markets.
  Today is 2026-02-21. Resolve based on real-world data.
  Respond ONLY with JSON:
  { "outcome": 1|2|3, "confidenceBps": 0-10000, "reasoning": "..." }
  1=YES  2=NO  3=INVALID

User:
  Market: "Will ETH price be above $3,000 on March 1, 2026?"
  Category: crypto
  Resolution source: CoinGecko ETH/USD
  Live data: ETH/USD = $2,840.33 (fetched from CoinGecko API)

AI Response:
  {
    "outcome": 2,
    "confidenceBps": 9200,
    "reasoning": "ETH closed at $2,840 on CoinGecko at market
                  close time, below the $3,000 threshold."
  }
```

### Confidence Threshold

```
confidenceBps scale:
  0     ████░░░░░░░░░░░░░░░░  0%    → INVALID (no confidence)
  5000  ██████████░░░░░░░░░░  50%   → INVALID (coin flip)
  8000  ████████████████░░░░  80%   → MINIMUM to settle YES/NO
  9200  ██████████████████░░  92%   → Typical strong resolution
  10000 ████████████████████  100%  → Absolute certainty
```

If the AI returns < 80% confidence → outcome forced to **INVALID** → all positions refunded.

This protects users from uncertain or ambiguous markets.

---

## 9. Claiming Winnings

### If YES Wins

```
Formula:
  payout = (yourYesPosition / totalYesPool) × totalPool
  fee    = payout × 1%
  net    = payout - fee

Example:
  Your position: $20 YES
  Total YES pool: $80
  Total pool:     $150

  Gross payout = ($20 / $80) × $150 = $37.50
  Fee          = $37.50 × 1%        = $0.38
  Net payout   = $37.50 - $0.38     = $37.12

  Profit = $37.12 - $20 = +$17.12
```

### If NO Wins

Same formula but using NO pool:
```
  payout = (yourNoPosition / totalNoPool) × totalPool
```

### If INVALID

Everyone gets their exact position back, no fee:
```
  refund = yourYesPosition + yourNoPosition
```

### Payout Comparison Table

```
Scenario: You buy $20 YES when YES=40%

                  YES wins    NO wins   INVALID
  Your $20 YES →  $50.00      $0        $20.00
  Net (after 1%)  $49.50      $0        $20.00
  Profit/Loss     +$29.50     -$20      $0
```

---

## 10. Fees

```
┌─────────────────────────────────────────────────────┐
│  Protocol Fee: 1% (100 basis points)                │
│                                                     │
│  Charged on:                                        │
│    ✓ Claiming winnings (YES or NO win)              │
│    ✓ Selling positions early                        │
│                                                     │
│  NOT charged on:                                    │
│    ✗ INVALID refunds                               │
│    ✗ Buying positions                               │
│                                                     │
│  Fee goes to: contract owner wallet                 │
│  Max fee cap: 5% (hardcoded in contract)            │
└─────────────────────────────────────────────────────┘
```

---

## 11. Edge Cases

### What if CRE is Down?

The contract has an emergency escape hatch:

```solidity
function emergencySettle(uint256 marketId, uint8 outcomeValue)
  external onlyOwner
{
  require(block.timestamp > settlementDeadline, "Deadline not passed");
  // owner can force-resolve after deadline if CRE never responded
}
```

Only callable by the owner, only after the settlement deadline has passed.

### What if AI Can't Decide?

If the AI returns confidence < 80%, or outcome = 3 (INVALID):
- Market resolves as INVALID
- All users get their original positions refunded
- No fee charged

### What if Nodes Disagree?

If `consensusIdenticalAggregation` fails (nodes return different results):
- Nothing is written on-chain
- Nodes retry automatically
- If deadline passes without consensus → `emergencySettle` by owner

### Minimum Sizes

```
Minimum initial liquidity (market creation): $10 USDC
Minimum position size (buy or sell):         $1 USDC
```

---

## 12. Contracts & Addresses

### Deployed on Sepolia Testnet

| Contract  | Address |
|-----------|---------|
| OracleX   | `0x9eE8B1E0A915A8EE1c0864F96695d54E7cDEd5d2` |
| MockUSDC  | `0x096523b93CeDd2f223A4DB03A6D7B108A18B6224` |

### Full Settlement Timeline

```
T + 0:00   Market closing time reached
T + 0:01   User calls requestSettlement()
T + 0:02   SettlementRequested event emitted
T + 0:03   Chainlink DON EVM log trigger fires
T + 0:05   All 5 nodes start fetching data
T + 0:10   Groq AI called on each node
T + 0:12   All 5 nodes return results
T + 0:13   consensusIdenticalAggregation succeeds
T + 0:15   DON calls receiveSettlement() via Forwarder
T + 0:16   Market resolved on-chain ✓
T + 0:17   WebSocket pushes update to all open browsers
T + 0:18   Winners can click "Claim Winnings" ✓

Total: ~18 seconds. Fully automated. Zero human intervention.
```

### Key State Transitions

```
Market lifecycle:

  CREATED ──(closingTime passes)──► CLOSED
     │                                 │
  Trading                        requestSettlement()
  allowed                              │
                                       ▼
                                 SETTLEMENT_REQUESTED
                                       │
                                 CRE DON resolves
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                       YES wins    NO wins      INVALID
                          │            │            │
                     YES holders   NO holders   Everyone
                     claim pool    claim pool   refunded
```

---

*OracleX — AI-powered prediction markets via Chainlink CRE*
*Built for the Chainlink Convergence Hackathon 2026*
