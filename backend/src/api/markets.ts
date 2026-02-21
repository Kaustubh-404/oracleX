import { Router } from "express";
import { prisma } from "../db";

const router = Router();

// GET /markets?category=Sports&status=open&page=1&limit=20
router.get("/", async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit    = Math.min(100, parseInt(req.query.limit as string) || 20);
    const category = req.query.category as string | undefined;
    const status   = req.query.status   as string | undefined;

    const now = new Date();

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (status === "open")     { where.outcome = 0; where.closingTime = { gt: now }; }
    if (status === "closed")   { where.outcome = 0; where.closingTime = { lte: now }; }
    if (status === "resolved") { where.outcome = { not: 0 }; }

    const [markets, total] = await Promise.all([
      prisma.market.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.market.count({ where }),
    ]);

    // Convert BigInts to strings for JSON serialisation
    const serialised = markets.map(serializeMarket);

    res.json({
      data:  serialised,
      meta:  { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[API] GET /markets error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /markets/:id
router.get("/:id", async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const market = await prisma.market.findUnique({
      where:   { id },
      include: { trades: { orderBy: { createdAt: "desc" }, take: 50 } },
    });

    if (!market) return res.status(404).json({ error: "Market not found" });

    res.json(serializeMarket(market));
  } catch (err) {
    console.error("[API] GET /markets/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /markets/:id/trades
router.get("/:id/trades", async (req, res) => {
  try {
    const marketId = BigInt(req.params.id);
    const page     = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit    = Math.min(200, parseInt(req.query.limit as string) || 50);

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where:   { marketId },
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.trade.count({ where: { marketId } }),
    ]);

    res.json({
      data: trades.map(serializeTrade),
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[API] GET /markets/:id/trades error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /markets/:id/probability-history
// Returns synthetic probability history derived from trade sequence
router.get("/:id/probability-history", async (req, res) => {
  try {
    const marketId = BigInt(req.params.id);

    const trades = await prisma.trade.findMany({
      where:   { marketId },
      orderBy: { createdAt: "asc" },
    });

    const market = await prisma.market.findUnique({ where: { id: marketId } });
    if (!market) return res.status(404).json({ error: "Market not found" });

    // Replay trades to build probability series
    let yesPool = 0;
    let noPool  = 0;
    const points: { t: string; prob: number }[] = [];

    // Initial point at market creation
    points.push({ t: market.createdAt.toISOString(), prob: 0.5 });

    for (const trade of trades) {
      const amt = parseFloat(trade.usdcAmount.toString());
      if (trade.action === "BUY") {
        if (trade.side === "YES") yesPool += amt;
        else                      noPool  += amt;
      } else {
        if (trade.side === "YES") yesPool = Math.max(0, yesPool - amt);
        else                      noPool  = Math.max(0, noPool  - amt);
      }
      const total = yesPool + noPool;
      const prob  = total > 0 ? yesPool / total : 0.5;
      points.push({ t: trade.createdAt.toISOString(), prob });
    }

    res.json(points);
  } catch (err) {
    console.error("[API] GET /markets/:id/probability-history error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function serializeMarket(m: Record<string, unknown>): Record<string, unknown> {
  return {
    ...m,
    id:              m.id?.toString(),
    aiConfidenceBps: m.aiConfidenceBps?.toString(),
    yesPool:         m.yesPool?.toString(),
    noPool:          m.noPool?.toString(),
    closingTime:     m.closingTime instanceof Date ? m.closingTime.toISOString() : m.closingTime,
    settlementDeadline: m.settlementDeadline instanceof Date
      ? (m.settlementDeadline as Date).toISOString()
      : m.settlementDeadline,
    createdAt:  m.createdAt instanceof Date  ? (m.createdAt  as Date).toISOString() : m.createdAt,
    updatedAt:  m.updatedAt instanceof Date  ? (m.updatedAt  as Date).toISOString() : m.updatedAt,
    trades:     Array.isArray(m.trades) ? (m.trades as Record<string, unknown>[]).map(serializeTrade) : undefined,
  };
}

function serializeTrade(t: Record<string, unknown>): Record<string, unknown> {
  return {
    ...t,
    marketId:    t.marketId?.toString(),
    blockNumber: t.blockNumber?.toString(),
    usdcAmount:  t.usdcAmount?.toString(),
    createdAt:   t.createdAt instanceof Date ? (t.createdAt as Date).toISOString() : t.createdAt,
  };
}

export default router;
