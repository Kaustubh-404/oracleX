import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketServer } from "socket.io";

import marketsRouter   from "./api/markets";
import positionsRouter from "./api/positions";
import aiRouter        from "./api/ai";
import { startIndexer } from "./indexer";

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

// Start the on-chain event indexer
startIndexer(io).catch((err) => {
  console.error("[Server] Indexer startup error:", err);
});
