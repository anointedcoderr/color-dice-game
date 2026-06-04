import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/errors";
import { maxPlayersFor, type RoomType } from "../shared/colors";
import * as registry from "../services/roomRegistry";

const router = Router();

// ── Users ────────────────────────────────────────────────────────────────────
router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = 25;

    const where: Prisma.UserWhereInput = q
      ? {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: pageSize,
        skip: (page - 1) * pageSize,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
          _count: { select: { roundPlayers: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        roundsPlayed: u._count.roundPlayers,
      })),
      total,
      page,
      pageSize,
    });
  }),
);

// ── Rooms (live counts overlaid from the in-memory registry) ──────────────────
router.get(
  "/rooms",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? "").trim();
    const where: Prisma.GameRoomWhereInput = status
      ? { status: status as Prisma.GameRoomWhereInput["status"] }
      : {};

    const rooms = await prisma.gameRoom.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { rounds: true } } },
    });
    const live = registry.snapshot();

    res.json({
      rooms: rooms.map((r) => {
        const snap = live.get(r.id);
        return {
          id: r.id,
          roomType: r.roomType,
          maxPlayers: r.maxPlayers,
          status: snap?.status ?? r.status,
          membersInRoom: snap?.memberCount ?? 0,
          currentRoundNumber: snap?.currentRoundNumber ?? null,
          totalRounds: r._count.rounds,
          createdAt: r.createdAt.toISOString(),
        };
      }),
    });
  }),
);

// POST /api/admin/rooms — create a waiting room (server sets maxPlayers).
router.post(
  "/rooms",
  asyncHandler(async (req, res) => {
    const roomType = req.body?.roomType as RoomType;
    if (roomType !== "two_player" && roomType !== "three_player") {
      throw new HttpError(400, "roomType must be two_player or three_player");
    }
    const dbRoom = await prisma.gameRoom.create({
      data: { roomType, maxPlayers: maxPlayersFor(roomType), status: "waiting" },
    });
    registry.create(dbRoom.id, roomType, dbRoom.maxPlayers);
    res.status(201).json({ room: { id: dbRoom.id, roomType, maxPlayers: dbRoom.maxPlayers, status: "waiting" } });
  }),
);

// POST /api/admin/rooms/:id/pause
router.post(
  "/rooms/:id/pause",
  asyncHandler(async (req, res) => {
    const room = await prisma.gameRoom.update({
      where: { id: req.params.id },
      data: { status: "paused" },
    });
    const live = registry.get(room.id);
    if (live) registry.pause(live);
    res.json({ room: { id: room.id, status: room.status } });
  }),
);

// POST /api/admin/rooms/:id/resume
router.post(
  "/rooms/:id/resume",
  asyncHandler(async (req, res) => {
    const room = await prisma.gameRoom.update({
      where: { id: req.params.id },
      data: { status: "waiting" },
    });
    const live = registry.get(room.id);
    if (live) registry.resume(live);
    res.json({ room: { id: room.id, status: room.status } });
  }),
);

// ── Completed / all rounds with search + filters ──────────────────────────────
function buildRoundWhere(query: Record<string, unknown>): Prisma.RoundWhereInput {
  const where: Prisma.RoundWhereInput = {};

  const roundId = String(query.roundId ?? "").trim();
  if (roundId) {
    if (/^\d+$/.test(roundId)) where.roundNumber = Number(roundId);
    else where.id = roundId;
  }

  const username = String(query.username ?? "").trim();
  if (username) {
    where.players = { some: { user: { username: { contains: username, mode: "insensitive" } } } };
  }

  const status = String(query.status ?? "").trim();
  if (status === "active" || status === "completed") where.status = status;

  const from = String(query.from ?? "").trim();
  const to = String(query.to ?? "").trim();
  if (from || to) {
    where.completedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    };
  }
  return where;
}

router.get(
  "/rounds",
  asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = 20;
    const where = buildRoundWhere(req.query as Record<string, unknown>);

    const [rounds, total] = await Promise.all([
      prisma.round.findMany({
        where,
        orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
        take: pageSize,
        skip: (page - 1) * pageSize,
        include: {
          room: true,
          players: {
            include: { user: { select: { id: true, username: true } } },
            orderBy: { playerPosition: "asc" },
          },
        },
      }),
      prisma.round.count({ where }),
    ]);

    res.json({
      rounds: rounds.map((round) => ({
        roundId: round.id,
        roundNumber: round.roundNumber,
        roomId: round.roomId,
        roomType: round.room.roomType,
        status: round.status,
        nonce: round.nonce,
        serverSeedHash: round.serverSeedHash,
        // Admin sees the seed only once the round is completed (same gate as users).
        serverSeed: round.status === "completed" ? round.serverSeed : null,
        createdAt: round.createdAt.toISOString(),
        completedAt: round.completedAt ? round.completedAt.toISOString() : null,
        fairnessVerified: round.status === "completed",
        players: round.players.map((p) => ({
          userId: p.userId ?? p.id,
          username: p.user?.username ?? p.playerName ?? "(guest)",
          playerPosition: p.playerPosition,
          hasTapped: p.hasTapped,
          resultColor: p.resultColor,
          finalHash: p.finalHash,
          tapTime: p.tapTime ? p.tapTime.toISOString() : null,
        })),
      })),
      total,
      page,
      pageSize,
    });
  }),
);

// ── CSV export (one row per round_player) ─────────────────────────────────────
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

router.get(
  "/rounds/export.csv",
  asyncHandler(async (req, res) => {
    const where = buildRoundWhere(req.query as Record<string, unknown>);
    const rounds = await prisma.round.findMany({
      where,
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
      include: {
        room: true,
        players: {
          include: { user: { select: { username: true } } },
          orderBy: { playerPosition: "asc" },
        },
      },
    });

    const header = [
      "roundId",
      "roundNumber",
      "roomId",
      "roomType",
      "roundStatus",
      "completedAt",
      "serverSeedHash",
      "serverSeed",
      "nonce",
      "playerPosition",
      "username",
      "resultColor",
      "hasTapped",
      "tapTime",
      "finalHash",
    ];

    const lines = [header.join(",")];
    for (const round of rounds) {
      const seed = round.status === "completed" ? round.serverSeed : "";
      for (const p of round.players) {
        lines.push(
          [
            round.id,
            round.roundNumber,
            round.roomId,
            round.room.roomType,
            round.status,
            round.completedAt ? round.completedAt.toISOString() : "",
            round.serverSeedHash,
            seed,
            round.nonce,
            p.playerPosition,
            p.user?.username ?? p.playerName ?? "(guest)",
            p.resultColor ?? "",
            p.hasTapped,
            p.tapTime ? p.tapTime.toISOString() : "",
            p.finalHash ?? "",
          ]
            .map(csvCell)
            .join(","),
        );
      }
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="rounds_export.csv"`);
    res.send(lines.join("\r\n"));
  }),
);

export default router;
