import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { serializeRound } from "../lib/serialize";

const router = Router();

// GET /api/rounds/history?limit&offset — my completed rounds.
router.get(
  "/history",
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const userId = req.user!.sub;

    const [rows, total] = await Promise.all([
      prisma.roundPlayer.findMany({
        where: { userId, round: { status: "completed" } },
        include: { round: { include: { room: true } } },
        orderBy: { round: { completedAt: "desc" } },
        take: limit,
        skip: offset,
      }),
      prisma.roundPlayer.count({ where: { userId, round: { status: "completed" } } }),
    ]);

    const rounds = rows.map((rp) => ({
      roundId: rp.roundId,
      roundNumber: rp.round.roundNumber,
      roomType: rp.round.room.roomType,
      status: rp.round.status,
      completedAt: rp.round.completedAt ? rp.round.completedAt.toISOString() : null,
      myPlayerPosition: rp.playerPosition,
      myResultColor: rp.resultColor,
      myFinalHash: rp.finalHash,
    }));

    res.json({ rounds, total, limit, offset });
  }),
);

// GET /api/rounds/:id — round detail (serverSeed only if completed).
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const round = await prisma.round.findUnique({
      where: { id: req.params.id },
      include: {
        room: true,
        players: {
          include: { user: { select: { id: true, username: true } } },
          orderBy: { playerPosition: "asc" },
        },
      },
    });
    if (!round) throw new HttpError(404, "Round not found");
    res.json({ round: serializeRound(round) });
  }),
);

export default router;
