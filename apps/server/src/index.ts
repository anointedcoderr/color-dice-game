import http from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";

import { env } from "./config/env";
import { requireAuth, requireAdmin } from "./middleware/auth";
import { errorHandler, notFound } from "./middleware/error";
import { registerSocket } from "./socket";

import authRoutes from "./routes/auth";
import roomRoutes from "./routes/rooms";
import roundRoutes from "./routes/rounds";
import userRoutes from "./routes/users";
import verifyRoutes from "./routes/verify";
import adminRoutes from "./routes/admin";
import localRoutes from "./routes/local";

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "./types/socket";

const app = express();
const server = http.createServer(app);

// ── CORS (REST) ───────────────────────────────────────────────────────────────
// Auth is a JWT in the Authorization header (no cookies), so reflecting any
// origin is safe: a third-party site still can't obtain a user's token, and
// every protected route requires that token. This makes the API work from any
// domain or device (custom domains, phones) with no per-origin configuration.
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "100kb" }));

// ── Health & info ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "colour-dice-arena", time: new Date().toISOString() });
});
app.get("/", (_req, res) => {
  res.json({ name: "Colour Dice Arena API", status: "running" });
});

// ── REST routes (all under /api) ──────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/rounds", roundRoutes);
app.use("/api/users", userRoutes);
app.use("/api/verify", verifyRoutes); // public — verification needs no auth
app.use("/api/local", localRoutes); // public — single-screen pass-and-play
app.use("/api/admin", requireAuth, requireAdmin, adminRoutes);

app.use(notFound);
app.use(errorHandler);

// ── Socket.io (shares the same http.Server / port) ────────────────────────────
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  cors: { origin: true, credentials: true },
  transports: ["websocket", "polling"],
});
registerSocket(io);

server.listen(env.PORT, () => {
  console.log(`🎲 Colour Dice Arena server listening on :${env.PORT}`);
  console.log(`   Allowed origins: ${env.CLIENT_ORIGIN}`);
});
