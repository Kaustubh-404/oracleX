import { Router } from "express";
import { prisma } from "../db";

const router = Router();

// GET /positions/:address — all trades for a wallet across all markets
router.get("/:address", async (req, res) => {
  try {
    const wallet = req.params.address.toLowerCase();
    const page   = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit  = Math.min(200, parseInt(req.query.limit as string) || 50);

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where:   { wallet },
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: "desc" },
        include: { market: true },
      }),
      prisma.trade.count({ where: { wallet } }),
    ]);

    // Aggregate net positions per market
    const positionMap: Record<string, { marketId: string; question: string; category: string; yesNet: number; noNet: number; outcome: number; closingTime: string }> = {};
    for (const trade of trades) {
      const mid = trade.marketId.toString();
      if (!positionMap[mid]) {
        positionMap[mid] = {
          marketId:    mid,
          question:    trade.market.question,
          category:    trade.market.category,
          yesNet:      0,
          noNet:       0,
          outcome:     trade.market.outcome,
          closingTime: trade.market.closingTime.toISOString(),
        };
      }
      const amt = parseFloat(trade.usdcAmount.toString());
      const sign = trade.action === "BUY" ? 1 : -1;
      if (trade.side === "YES") positionMap[mid].yesNet += sign * amt;
      else                      positionMap[mid].noNet  += sign * amt;
    }

    const positions = Object.values(positionMap).filter(
      (p) => p.yesNet > 0 || p.noNet > 0
    );

    res.json({
      data:      positions,
      allTrades: trades.map(serializeTrade),
      meta:      { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[API] GET /positions/:address error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /positions/:address/brier — Brier score + calibration grade
// Must be defined BEFORE /:address to avoid being swallowed by that route
router.get("/:address/brier", async (req, res) => {
  try {
    const wallet = req.params.address.toLowerCase();

    // All BUY trades for resolved markets (outcome 1=YES, 2=NO — skip INVALID/unresolved)
    const trades = await prisma.trade.findMany({
      where:   { wallet, action: "BUY" },
      include: { market: true },
    });

    const resolved = trades.filter(
      (t) => t.market.outcome === 1 || t.market.outcome === 2
    );

    if (resolved.length === 0) {
      return res.json({ score: null, grade: null, resolvedTrades: 0 });
    }

    let total = 0;
    for (const t of resolved) {
      const yp = parseFloat(t.market.yesPool.toString());
      const np = parseFloat(t.market.noPool.toString());
      const poolTotal = yp + np;

      // Implied probability for YES at resolution time (pool ratio as proxy)
      const yesProbAtRes = poolTotal > 0 ? yp / poolTotal : 0.5;

      // Probability the user bet on
      const prob = t.side === "YES" ? yesProbAtRes : 1 - yesProbAtRes;

      // Did the user's side win? 1 = correct, 0 = wrong
      const won = (t.side === "YES" && t.market.outcome === 1) ||
                  (t.side === "NO"  && t.market.outcome === 2) ? 1 : 0;

      // Brier score per trade: (probability - outcome)²
      total += (prob - won) ** 2;
    }

    const score = total / resolved.length;

    // Grade thresholds (lower Brier = better)
    const grade =
      score < 0.10 ? "A" :
      score < 0.15 ? "B" :
      score < 0.20 ? "C" :
      score < 0.25 ? "D" : "F";

    res.json({ score: parseFloat(score.toFixed(4)), grade, resolvedTrades: resolved.length });
  } catch (err) {
    console.error("[API] GET /positions/:address/brier error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /leaderboard — ranked wallets by total volume
router.get("/leaderboard/all", async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);

    // Aggregate total USDC volume per wallet
    const rows = await prisma.trade.groupBy({
      by:        ["wallet"],
      _sum:      { usdcAmount: true },
      _count:    { id: true },
      orderBy:   { _sum: { usdcAmount: "desc" } },
      take:      limit,
    });

    const leaderboard = rows.map((row: typeof rows[number], i: number) => ({
      rank:        i + 1,
      wallet:      row.wallet,
      totalVolume: row._sum.usdcAmount?.toString() ?? "0",
      tradeCount:  row._count.id,
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error("[API] GET /leaderboard error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

function serializeTrade(t: Record<string, unknown>): Record<string, unknown> {
  const market = t.market as Record<string, unknown> | undefined;
  return {
    ...t,
    marketId:    t.marketId?.toString(),
    blockNumber: t.blockNumber?.toString(),
    usdcAmount:  t.usdcAmount?.toString(),
    createdAt:   t.createdAt instanceof Date ? (t.createdAt as Date).toISOString() : t.createdAt,
    market:      market
      ? {
          ...market,
          id:              market.id?.toString(),
          aiConfidenceBps: market.aiConfidenceBps?.toString(),
          yesPool:         market.yesPool?.toString(),
          noPool:          market.noPool?.toString(),
          closingTime:     market.closingTime instanceof Date ? (market.closingTime as Date).toISOString() : market.closingTime,
        }
      : undefined,
  };
}

export default router;
