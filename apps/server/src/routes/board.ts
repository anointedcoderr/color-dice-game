import { Router } from "express";
import { randomInt } from "node:crypto";
import { asyncHandler } from "../lib/asyncHandler";
import { COLORS } from "../shared/colors";

// Board Game companion: a stateless dice roll for pairing with a physical
// board game. No session state on purpose: the board and every player's
// score live only in the browser tab. The one thing that must still come
// from the server is the colour itself, so a player can never influence or
// predict their own roll.

const router = Router();

// POST /api/board/roll -> one cryptographically-random colour, nothing else.
router.post(
  "/roll",
  asyncHandler(async (_req, res) => {
    const color = COLORS[randomInt(0, COLORS.length)];
    res.json({ color });
  }),
);

export default router;
