import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/errors";
import { buildMessage, computeResult, hashServerSeed } from "../lib/fairness";
import { COLORS } from "../shared/colors";

const router = Router();

// GET /api/verify/:roundId — public fairness data for a COMPLETED round only.
router.get(
  "/:roundId",
  asyncHandler(async (req, res) => {
    const round = await prisma.round.findUnique({
      where: { id: req.params.roundId },
      include: {
        room: true,
        players: {
          include: { user: { select: { id: true, username: true } } },
          orderBy: { playerPosition: "asc" },
        },
      },
    });

    // Never confirm seed data for a non-completed round.
    if (!round || round.status !== "completed") {
      throw new HttpError(404, "Round not available for verification");
    }

    res.json({
      roundId: round.id,
      roundNumber: round.roundNumber,
      roomId: round.roomId,
      roomType: round.room.roomType,
      status: round.status,
      completedAt: round.completedAt ? round.completedAt.toISOString() : null,
      nonce: round.nonce,
      serverSeedHash: round.serverSeedHash,
      serverSeed: round.serverSeed, // revealed — round is completed
      colors: COLORS,
      players: round.players.map((p) => {
        const subject = p.userId ?? p.id;
        return {
          userId: subject,
          username: p.user?.username ?? p.playerName ?? null,
          playerPosition: p.playerPosition,
          resultColor: p.resultColor,
          finalHash: p.finalHash,
          tapTime: p.tapTime ? p.tapTime.toISOString() : null,
          inputString: buildMessage(round.id, subject, p.playerPosition, round.nonce),
        };
      }),
    });
  }),
);

const verifySchema = z.object({
  serverSeed: z.string().min(1),
  roundId: z.string().min(1),
  userId: z.string().min(1),
  playerPosition: z.coerce.number().int().positive(),
  nonce: z.coerce.number().int().nonnegative(),
  serverSeedHash: z.string().optional(),
  finalHash: z.string().optional(),
  resultColor: z.string().optional(),
});

// POST /api/verify — recompute independently from a supplied seed.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const input = parsed.data;
    const computed = computeResult({
      serverSeed: input.serverSeed,
      roundId: input.roundId,
      userId: input.userId,
      playerPosition: input.playerPosition,
      nonce: input.nonce,
    });

    const seedHashMatches = input.serverSeedHash
      ? hashServerSeed(input.serverSeed) === input.serverSeedHash.toLowerCase()
      : null;
    const finalHashMatches = input.finalHash
      ? computed.finalHash.toLowerCase() === input.finalHash.toLowerCase()
      : null;
    const colorMatches = input.resultColor ? computed.resultColor === input.resultColor : null;

    const verified =
      (seedHashMatches ?? true) && (finalHashMatches ?? true) && (colorMatches ?? true);

    res.json({
      inputString: computed.inputString,
      computedHash: computed.finalHash,
      computedColor: computed.resultColor,
      computedServerSeedHash: hashServerSeed(input.serverSeed),
      seedHashMatches,
      finalHashMatches,
      colorMatches,
      verified,
    });
  }),
);

export default router;
