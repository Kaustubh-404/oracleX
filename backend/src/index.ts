import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketServer } from "socket.io";

import marketsRouter   from "./api/markets";
import positionsRouter from "./api/positions";
import aiRouter        from "./api/ai";
import verifyRouter    from "./api/verify";
import { startChainIndexer } from "./indexer";

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

// ── Express app ──────────────────────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

// ── REST routes ──────────────────────────────────────────────────────────────

app.use("/markets",   marketsRouter);
app.use("/positions", positionsRouter);
app.use("/ai",        aiRouter);
app.use("/verify",    verifyRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

// ── Socket.io ────────────────────────────────────────────────────────────────

const io = new SocketServer(server, {
  cors: { origin: FRONTEND_URL, methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  socket.on("subscribeMarket", (marketId: string) => {
    socket.join(`market:${marketId}`);
  });

  socket.on("unsubscribeMarket", (marketId: string) => {
    socket.leave(`market:${marketId}`);
  });

  socket.on("disconnect", () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] CORS origin: ${FRONTEND_URL}`);
});

// Start indexer for Ethereum Sepolia
const SEPOLIA_RPC = process.env.RPC_URL ?? "";
startChainIndexer("sepolia", process.env.ORACLEX_ADDRESS ?? "", SEPOLIA_RPC, io)
  .catch((err) => console.error("[Indexer:sepolia] startup error:", err));

// Start indexer for World Chain (mainnet — mini apps only work on mainnet)
const WORLD_CHAIN_SLUG = process.env.WORLD_CHAIN_SLUG ?? "worldchain";
const WORLD_CONTRACT   = process.env.WORLD_ORACLEX_ADDRESS ?? "";
const WORLD_RPC        = process.env.WORLD_CHAIN_RPC_URL ?? "https://worldchain-mainnet.g.alchemy.com/public";
const WORLD_START      = BigInt(process.env.WORLD_START_BLOCK ?? "26797490");
if (WORLD_CONTRACT && WORLD_CONTRACT !== "0x0000000000000000000000000000000000000000") {
  startChainIndexer(WORLD_CHAIN_SLUG, WORLD_CONTRACT, WORLD_RPC, io, WORLD_START)
    .catch((err) => console.error(`[Indexer:${WORLD_CHAIN_SLUG}] startup error:`, err));
}
