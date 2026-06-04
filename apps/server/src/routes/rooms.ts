import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { serializeRound } from "../lib/serialize";

const router = Router();

// GET /api/rooms/:id — hydrate room + latest round (used on reconnect / refresh).
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const room = await prisma.gameRoom.findUnique({ where: { id: req.params.id } });
    if (!room) throw new HttpError(404, "Room not found");

    const round = await prisma.round.findFirst({
      where: { roomId: room.id },
      orderBy: { roundNumber: "desc" },
      include: {
        room: true,
        players: {
          include: { user: { select: { id: true, username: true } } },
          orderBy: { playerPosition: "asc" },
        },
      },
    });

    let serialized = round ? serializeRound(round) : null;

    // Privacy: if the round is still in progress and the requester is neither a
    // participant nor an admin, hide per-player colours/hashes.
    if (serialized && round && round.status !== "completed" && req.user!.role !== "admin") {
      const isParticipant = round.players.some((p) => p.userId === req.user!.sub);
      if (!isParticipant) {
        serialized = {
          ...serialized,
          players: serialized.players?.map((p) => ({
            ...p,
            resultColor: null,
            finalHash: null,
          })),
        };
      }
    }

    res.json({
      room: {
        id: room.id,
        roomType: room.roomType,
        maxPlayers: room.maxPlayers,
        status: room.status,
      },
      round: serialized,
    });
  }),
);

export default router;
