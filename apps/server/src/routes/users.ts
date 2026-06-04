import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { COLORS } from "../shared/colors";

const router = Router();

// GET /api/users/me/stats — profile stats + colour distribution.
router.get(
  "/me/stats",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(401, "User no longer exists");

    const grouped = await prisma.roundPlayer.groupBy({
      by: ["resultColor"],
      where: { userId, hasTapped: true, resultColor: { not: null } },
      _count: { _all: true },
    });

    const distribution: Record<string, number> = Object.fromEntries(COLORS.map((c) => [c, 0]));
    let totalRounds = 0;
    for (const g of grouped) {
      if (g.resultColor) {
        distribution[g.resultColor] = g._count._all;
        totalRounds += g._count._all;
      }
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      totalRounds,
      distribution,
    });
  }),
);

export default router;
