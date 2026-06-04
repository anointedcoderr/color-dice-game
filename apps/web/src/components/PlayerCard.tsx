"use client";

import { motion } from "framer-motion";
import { clsx } from "clsx";
import { COLOR_HEX, COLOR_GLOW, COLOR_TEXT_ON, colorLabel } from "@/lib/colors";
import type { PlayerSlot } from "@/lib/types";

function formatTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

export function PlayerCard({ player, isMe }: { player: PlayerSlot; isMe: boolean }) {
  const { resultColor, hasTapped } = player;

  return (
    <div
      className={clsx(
        "glass flex flex-col gap-3 rounded-2xl border p-4 transition",
        isMe ? "border-indigo-400/50 ring-1 ring-indigo-400/30" : "border-white/10",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-xs font-bold text-zinc-300">
            {player.playerPosition}
          </span>
          <span className="font-semibold text-zinc-100">
            {player.username}
            {isMe && <span className="ml-1 text-xs font-normal text-indigo-300">(you)</span>}
          </span>
        </div>
        {!player.connected && <span className="text-xs text-amber-400/80">offline</span>}
      </div>

      <div className="flex min-h-[44px] items-center justify-between">
        {resultColor ? (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold"
            style={{
              backgroundColor: COLOR_HEX[resultColor],
              color: COLOR_TEXT_ON[resultColor],
              boxShadow: `0 0 22px 1px ${COLOR_GLOW[resultColor]}`,
            }}
          >
            {colorLabel(resultColor)}
          </motion.div>
        ) : hasTapped ? (
          <span className="text-sm font-medium text-emerald-400">Tapped ✓</span>
        ) : (
          <span className="text-sm text-zinc-500">Waiting…</span>
        )}
        <span className="font-mono text-[11px] text-zinc-500">{formatTime(player.tapTime)}</span>
      </div>
    </div>
  );
}
