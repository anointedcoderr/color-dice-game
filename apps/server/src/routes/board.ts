import { Router } from "express";
import { randomInt } from "node:crypto";
import { asyncHandler } from "../lib/asyncHandler";
import { COLORS } from "../shared/colors";

// Board Game companion: a stateless dice roll for pairing with a physical
// board game. No session state on purpose: the board and every player's
// score live only in the browser tab. The one thing that must still come
// from the server is the colour itself, so a player can never influence or
// predict their own roll.
//
// Unlike /api/local and the online rooms, there is deliberately no seed
// commitment here. That ceremony exists so a *stored* result can be
// independently re-derived later; nothing is stored here, so a commitment
// would have no verification target. Do not add one without also adding
// persistence and a /verify path for it.

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
