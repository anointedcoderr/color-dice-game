"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { COLOR_HEX, COLOR_GLOW, COLOR_TEXT_ON, colorLabel } from "@/lib/colors";
import { Button, Card, HashChip } from "@/components/ui";
import type { CompletedPlayer, RoomState } from "@/lib/types";

function verifyHref(room: RoomState, player: CompletedPlayer) {
  const params = new URLSearchParams({
    roundId: room.roundId ?? "",
    userId: player.userId,
    playerPosition: String(player.playerPosition),
    nonce: String(room.nonce ?? ""),
    serverSeed: room.serverSeed ?? "",
    serverSeedHash: room.serverSeedHash ?? "",
    finalHash: player.finalHash ?? "",
    resultColor: player.resultColor ?? "",
  });
  return `/verify?${params.toString()}`;
}

export function RoundSummary({ room, onPlayAgain }: { room: RoomState; onPlayAgain: () => void }) {
  const players = room.completedSummary ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Card className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-zinc-100">Round completed</h3>
            <p className="text-sm text-zinc-400">Round #{room.roundNumber}</p>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
            ✓ Completed
          </span>
        </div>

        <div className="space-y-2">
          {players.map((p) => (
            <div
              key={p.userId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-xs font-bold">
                  {p.playerPosition}
                </span>
                <span className="font-medium">{p.username}</span>
              </div>
              <div className="flex items-center gap-3">
                {p.resultColor && (
                  <span
                    className="rounded-lg px-3 py-1 text-sm font-bold"
                    style={{
                      backgroundColor: COLOR_HEX[p.resultColor],
                      color: COLOR_TEXT_ON[p.resultColor],
                      boxShadow: `0 0 18px 1px ${COLOR_GLOW[p.resultColor]}`,
                    }}
                  >
                    {colorLabel(p.resultColor)}
                  </span>
                )}
                <Link
                  href={verifyHref(room, p)}
                  className="text-xs font-medium text-indigo-300 underline-offset-2 hover:underline"
                >
                  Verify
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-white/10 pt-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Provably fair</p>
          <div className="flex flex-col gap-2">
            <HashChip label="seed hash" value={room.serverSeedHash ?? "—"} />
            <HashChip label="server seed (revealed)" value={room.serverSeed ?? "—"} />
            <HashChip label="nonce" value={String(room.nonce ?? "—")} />
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={onPlayAgain}>Play again</Button>
          <Link href="/history">
            <Button variant="ghost">View history</Button>
          </Link>
        </div>
      </Card>
    </motion.div>
  );
}
