import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/errors";
import { computeResult, generateServerSeed, hashServerSeed } from "../lib/fairness";
import { maxPlayersFor } from "../shared/colors";

// ── Single-screen "pass-and-play" mode (no auth) ──────────────────────────────
// Everyone shares one device. We create a round with guest seats (userId = null,
// playerName set), and reveal one seat's colour per tap. Still server-side and
// provably fair — the fairness "subject" for a guest seat is its own row id.

const router = Router();

const createSchema = z.object({
  roomType: z.enum(["two_player", "three_player"]),
  players: z
    .array(z.object({ name: z.string().trim().max(20).optional() }))
    .min(2)
    .max(3),
});

// POST /api/local/rounds — start a single-screen round.
router.post(
  "/rounds",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { roomType, players } = parsed.data;
    const maxPlayers = maxPlayersFor(roomType);
    if (players.length !== maxPlayers) {
      throw new HttpError(400, `Provide exactly ${maxPlayers} players`);
    }

    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);

    const result = await prisma.$transaction(async (tx) => {
      const room = await tx.gameRoom.create({
        data: { roomType, maxPlayers, status: "active" },
      });
      const round = await tx.round.create({
        data: {
          roomId: room.id,
          roundNumber: 1,
          status: "active",
          serverSeedHash,
          serverSeed,
          nonce: 1,
        },
      });
      const seats = [];
      for (let i = 0; i < players.length; i++) {
        const name = players[i].name?.trim() || `Player ${i + 1}`;
        const seat = await tx.roundPlayer.create({
          data: {
            roundId: round.id,
            userId: null,
            playerName: name,
            playerPosition: i + 1,
            hasTapped: false,
          },
        });
        seats.push(seat);
      }
      return { round, seats };
    });

    res.status(201).json({
      roundId: result.round.id,
      roundNumber: result.round.roundNumber,
      roomType,
      maxPlayers,
      nonce: result.round.nonce,
      serverSeedHash,
      players: result.seats.map((p) => ({
        playerPosition: p.playerPosition,
        name: p.playerName,
        hasTapped: false,
        resultColor: null as string | null,
      })),
    });
  }),
);

const tapSchema = z.object({ playerPosition: z.coerce.number().int().positive() });

// POST /api/local/rounds/:id/tap — reveal one seat's colour.
router.post(
  "/rounds/:id/tap",
  asyncHandler(async (req, res) => {
    const parsed = tapSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "playerPosition is required");
    const roundId = req.params.id;
    const { playerPosition } = parsed.data;

    // Every query below that doesn't depend on a prior result's data runs in
    // parallel — each round trip to the database adds real, felt latency to
    // the roll, since the dice can't reveal until this responds.
    const out = await prisma.$transaction(async (tx) => {
      const [round, seats] = await Promise.all([
        tx.round.findUnique({ where: { id: roundId } }),
        tx.roundPlayer.findMany({ where: { roundId } }),
      ]);
      if (!round || round.status === "completed") throw new HttpError(409, "Round is not active");

      const seat = seats.find((s) => s.playerPosition === playerPosition);
      if (!seat) throw new HttpError(404, "Player seat not found");
      if (seat.userId) throw new HttpError(403, "Not a single-screen round");
      if (seat.hasTapped) throw new HttpError(409, "This player already tapped");

      const subject = seat.id; // guest fairness subject = the seat's own id
      const { finalHash, resultColor } = computeResult({
        serverSeed: round.serverSeed,
        roundId,
        userId: subject,
        playerPosition,
        nonce: round.nonce,
      });
      const tapTime = new Date();

      await Promise.all([
        tx.roundPlayer.update({
          where: { id: seat.id },
          data: { hasTapped: true, tapTime, resultColor, finalHash },
        }),
        tx.fairnessLog.create({
          data: {
            roundId,
            userId: null,
            playerName: seat.playerName,
            serverSeed: round.serverSeed,
            serverSeedHash: round.serverSeedHash,
            nonce: round.nonce,
            playerPosition,
            finalHash,
            resultColor,
          },
        }),
      ]);

      // The other seats' tapped state was already read above (this seat is
      // the only one this transaction touches), so completion is known
      // without a further round trip.
      const remaining = seats.filter((s) => s.id !== seat.id && !s.hasTapped).length;
      let completed = false;
      if (remaining === 0) {
        await Promise.all([
          tx.round.update({
            where: { id: roundId },
            data: { status: "completed", completedAt: new Date() },
          }),
          tx.gameRoom.update({
            where: { id: round.roomId },
            data: { status: "completed" },
          }),
        ]);
        completed = true;
      }
      return { resultColor, completed };
    });

    res.json({ playerPosition, resultColor: out.resultColor, completed: out.completed });
  }),
);

export default router;
