/**
 * OracleX Event Indexer
 * Listens to contract events on Sepolia and syncs them into Supabase (Prisma).
 * Events indexed:
 *   - MarketCreated
 *   - PositionTaken
 *   - PositionSold
 *   - SettlementRequested
 *   - MarketSettled
 */
import {
  createPublicClient,
  http,
  parseAbiItem,
  toEventSelector,
  decodeEventLog,
  type Log,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { prisma } from "./db";
import type { Server as SocketServer } from "socket.io";

// ── ABI event fragments ──────────────────────────────────────────────────────

const MARKET_CREATED = parseAbiItem(
  "event MarketCreated(uint256 indexed marketId, string question, string category, uint256 closingTime, address creator)"
);
const POSITION_TAKEN = parseAbiItem(
  "event PositionTaken(uint256 indexed marketId, address indexed user, bool isYes, uint256 amount)"
);
const POSITION_SOLD = parseAbiItem(
  "event PositionSold(uint256 indexed marketId, address indexed user, bool isYes, uint256 amountIn, uint256 proceeds)"
);
const SETTLEMENT_REQUESTED = parseAbiItem(
  "event SettlementRequested(uint256 indexed marketId, string question, uint256 requestedAt)"
);
const MARKET_SETTLED = parseAbiItem(
  "event MarketSettled(uint256 indexed marketId, uint8 outcome, uint256 confidenceBps, string aiReasoning)"
);

// Pre-compute topic0 selectors for fast matching
const TOPIC_MARKET_CREATED       = toEventSelector(MARKET_CREATED);
const TOPIC_POSITION_TAKEN       = toEventSelector(POSITION_TAKEN);
const TOPIC_POSITION_SOLD        = toEventSelector(POSITION_SOLD);
const TOPIC_SETTLEMENT_REQUESTED = toEventSelector(SETTLEMENT_REQUESTED);
const TOPIC_MARKET_SETTLED       = toEventSelector(MARKET_SETTLED);

// ── Viem client ──────────────────────────────────────────────────────────────

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL!),
});

// ── Main indexer loop ────────────────────────────────────────────────────────

export async function startIndexer(io: SocketServer): Promise<void> {
  const CONTRACT = process.env.ORACLEX_ADDRESS as Address;
  if (!CONTRACT || CONTRACT === "0x0000000000000000000000000000000000000000") {
    console.warn("[Indexer] CONTRACT_ADDRESS not set — indexer paused");
    return;
  }

  // Restore last indexed block from DB — resume from where we left off,
  // but never go earlier than START_BLOCK env var.
  const envStartBlock = BigInt(process.env.START_BLOCK ?? "0");
  const state = await prisma.indexerState.upsert({
    where:  { id: 1 },
    create: { id: 1, lastBlock: envStartBlock },
    update: {}, // preserve saved progress across restarts
  });

  // Use max(saved, env) so lowering START_BLOCK takes effect but progress is kept
  const fromBlock = state.lastBlock > envStartBlock ? state.lastBlock : envStartBlock;
  // Persist the resolved start block
  await prisma.indexerState.update({ where: { id: 1 }, data: { lastBlock: fromBlock } });
  console.log(`[Indexer] Starting from block ${fromBlock}`);

  // ── Historical catch-up ────────────────────────────────────────────────────
  await catchUp(CONTRACT, fromBlock, io);

  // ── Live subscription ──────────────────────────────────────────────────────
  client.watchContractEvent({
    address: CONTRACT,
    abi: [MARKET_CREATED, POSITION_TAKEN, POSITION_SOLD, SETTLEMENT_REQUESTED, MARKET_SETTLED],
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleLog(log as Log, io);
      }
      if (logs.length > 0 && logs[logs.length - 1].blockNumber) {
        await prisma.indexerState.update({
          where:  { id: 1 },
          data:   { lastBlock: logs[logs.length - 1].blockNumber! },
        });
      }
    },
    onError: (err) => console.error("[Indexer] Watch error:", err),
  });

  console.log("[Indexer] Live subscription active");
}

async function catchUp(
  contract: Address,
  fromBlock: bigint,
  io: SocketServer
): Promise<void> {
  const latest = await client.getBlockNumber();
  if (fromBlock >= latest) return;

  console.log(`[Indexer] Catching up blocks ${fromBlock} → ${latest}`);

  // Alchemy free tier: max 10 blocks per eth_getLogs request
  const CHUNK = 10n;
  for (let from = fromBlock; from <= latest; from += CHUNK) {
    const to = from + CHUNK - 1n < latest ? from + CHUNK - 1n : latest;

    const logs = await client.getLogs({
      address: contract,
      fromBlock: from,
      toBlock:   to,
    });

    for (const log of logs) {
      await handleLog(log, io);
    }

    await prisma.indexerState.update({
      where:  { id: 1 },
      data:   { lastBlock: to },
    });
  }

  console.log("[Indexer] Catch-up complete");
}

// ── Event dispatch ───────────────────────────────────────────────────────────

async function handleLog(log: Log, io: SocketServer): Promise<void> {
  try {
    const topic0 = log.topics[0];
    if (!topic0) return;

    // Decode raw log args (needed when coming from getLogs catch-up)
    // watchContractEvent already decodes, but getLogs returns raw logs
    const decode = (abi: Parameters<typeof decodeEventLog>[0]["abi"][number]) => {
      try {
        return decodeEventLog({ abi: [abi] as Parameters<typeof decodeEventLog>[0]["abi"], data: log.data as `0x${string}`, topics: log.topics as [`0x${string}`, ...`0x${string}`[]] });
      } catch { return null; }
    };

    if (topic0 === TOPIC_MARKET_CREATED) {
      const decoded = (log as any).args ?? decode(MARKET_CREATED)?.args;
      if (decoded) await onMarketCreated({ args: decoded, blockNumber: log.blockNumber! }, io);
    } else if (topic0 === TOPIC_POSITION_TAKEN) {
      const decoded = (log as any).args ?? decode(POSITION_TAKEN)?.args;
      if (decoded) await onPositionTaken({ args: decoded, txHash: log.transactionHash ?? undefined, blockNumber: log.blockNumber ?? undefined, logIndex: log.logIndex ?? undefined }, io);
    } else if (topic0 === TOPIC_POSITION_SOLD) {
      const decoded = (log as any).args ?? decode(POSITION_SOLD)?.args;
      if (decoded) await onPositionSold({ args: decoded, txHash: log.transactionHash ?? undefined, blockNumber: log.blockNumber ?? undefined, logIndex: log.logIndex ?? undefined }, io);
    } else if (topic0 === TOPIC_SETTLEMENT_REQUESTED) {
      const decoded = (log as any).args ?? decode(SETTLEMENT_REQUESTED)?.args;
      if (decoded) await onSettlementRequested({ args: decoded }, io);
    } else if (topic0 === TOPIC_MARKET_SETTLED) {
      const decoded = (log as any).args ?? decode(MARKET_SETTLED)?.args;
      if (decoded) await onMarketSettled({ args: decoded }, io);
    }
  } catch (e) {
    console.error("[Indexer] handleLog error:", e);
  }
}


// ── Event Handlers ───────────────────────────────────────────────────────────

async function onMarketCreated(
  log: { args: { marketId: bigint; question: string; category: string; closingTime: bigint; creator: string }; blockNumber: bigint },
  io: SocketServer
): Promise<void> {
  const { marketId, question, category, closingTime, creator } = log.args;

  await prisma.market.upsert({
    where:  { id: marketId },
    create: {
      id:                 marketId,
      question,
      category,
      resolutionSource:   "",
      creator,
      collateral:         process.env.USDC_ADDRESS ?? "",
      closingTime:        new Date(Number(closingTime) * 1000),
      settlementDeadline: new Date((Number(closingTime) + 7 * 86400) * 1000),
    },
    update: { question, category, closingTime: new Date(Number(closingTime) * 1000) },
  });

  io.emit("marketCreated", { marketId: marketId.toString(), question, category });
  console.log(`[Indexer] MarketCreated #${marketId}: "${question}"`);
}

async function onPositionTaken(
  log: { args: { marketId: bigint; user: string; isYes: boolean; amount: bigint }; txHash?: string; blockNumber?: bigint; logIndex?: number },
  io: SocketServer
): Promise<void> {
  const { marketId, user, isYes, amount } = log.args;
  const amountDecimal = Number(amount) / 1e6;

  // Upsert trade record — skip if market not yet indexed (FK violation)
  let isNew = false;
  if (log.txHash && log.logIndex !== undefined) {
    const existing = await prisma.trade.findUnique({
      where: { txHash_logIndex: { txHash: log.txHash, logIndex: log.logIndex } },
    });
    if (!existing) {
      await prisma.trade.create({
        data: {
          marketId,
          wallet:      user,
          side:        isYes ? "YES" : "NO",
          usdcAmount:  amountDecimal,
          action:      "BUY",
          txHash:      log.txHash,
          blockNumber: log.blockNumber ?? null,
          logIndex:    log.logIndex,
        },
      });
      isNew = true;
    }
  }

  // Only update pool balances for newly indexed trades to avoid double-counting on replay
  if (isNew) {
    if (isYes) {
      await prisma.market.update({
        where: { id: marketId },
        data:  { yesPool: { increment: amountDecimal } },
      });
    } else {
      await prisma.market.update({
        where: { id: marketId },
        data:  { noPool: { increment: amountDecimal } },
      });
    }
  }

  io.emit("positionTaken", {
    marketId: marketId.toString(),
    user,
    isYes,
    amount: amountDecimal,
  });
}

async function onPositionSold(
  log: { args: { marketId: bigint; user: string; isYes: boolean; amountIn: bigint; proceeds: bigint }; txHash?: string; blockNumber?: bigint; logIndex?: number },
  io: SocketServer
): Promise<void> {
  const { marketId, user, isYes, amountIn, proceeds } = log.args;
  const amountDecimal = Number(amountIn) / 1e6;

  let isNew = false;
  if (log.txHash && log.logIndex !== undefined) {
    const existing = await prisma.trade.findUnique({
      where: { txHash_logIndex: { txHash: log.txHash, logIndex: log.logIndex } },
    });
    if (!existing) {
      await prisma.trade.create({
        data: {
          marketId,
          wallet:      user,
          side:        isYes ? "YES" : "NO",
          usdcAmount:  amountDecimal,
          action:      "SELL",
          txHash:      log.txHash,
          blockNumber: log.blockNumber ?? null,
          logIndex:    log.logIndex,
        },
      });
      isNew = true;
    }
  }

  // Only update pool balances for newly indexed trades to avoid double-counting on replay
  if (isNew) {
    const spread = Number(amountIn - proceeds) / 1e6;
    if (isYes) {
      await prisma.market.update({
        where: { id: marketId },
        data:  {
          yesPool: { decrement: amountDecimal },
          noPool:  { increment: spread },
        },
      });
    } else {
      await prisma.market.update({
        where: { id: marketId },
        data:  {
          noPool:  { decrement: amountDecimal },
          yesPool: { increment: spread },
        },
      });
    }
  }

  io.emit("positionSold", { marketId: marketId.toString(), user, isYes });
}

async function onSettlementRequested(
  log: { args: { marketId: bigint } },
  _io: SocketServer
): Promise<void> {
  const { marketId } = log.args;
  await prisma.market.update({
    where: { id: marketId },
    data:  { settlementRequested: true },
  });
  console.log(`[Indexer] SettlementRequested #${marketId}`);
}

async function onMarketSettled(
  log: { args: { marketId: bigint; outcome: number; confidenceBps: bigint; aiReasoning: string } },
  io: SocketServer
): Promise<void> {
  const { marketId, outcome, confidenceBps, aiReasoning } = log.args;

  await prisma.market.update({
    where: { id: marketId },
    data:  {
      outcome,
      aiConfidenceBps: confidenceBps,
      aiReasoning,
    },
  });

  io.emit("marketSettled", {
    marketId: marketId.toString(),
    outcome,
    confidenceBps: confidenceBps.toString(),
    aiReasoning,
  });

  console.log(`[Indexer] MarketSettled #${marketId} → ${outcome}`);
}
