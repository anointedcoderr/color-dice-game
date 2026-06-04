"use client";

import { motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef } from "react";
import { COLORS, COLOR_HEX, COLOR_GLOW, COLOR_TEXT_ON, NEUTRAL_GLOW } from "@/lib/colors";
import { colorLabel } from "@/lib/colors";
import type { ColorName } from "@/lib/types";

export type DicePhase = "neutral" | "spinning" | "settled";

export function Dice({ phase, result }: { phase: DicePhase; result: ColorName | null }) {
  const controls = useAnimationControls();
  const spinTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const clear = () => {
      if (spinTimer.current) {
        clearInterval(spinTimer.current);
        spinTimer.current = null;
      }
    };

    if (phase === "spinning") {
      let i = 0;
      spinTimer.current = setInterval(() => {
        const c = COLORS[i++ % COLORS.length];
        controls.set({ backgroundColor: COLOR_HEX[c] });
      }, 70);
      void controls.start({
        rotate: [0, 360, 720],
        scale: [1, 1.12, 1],
        boxShadow: `0 0 50px 6px ${NEUTRAL_GLOW}`,
        transition: { duration: 0.9, ease: "easeInOut", repeat: Infinity },
      });
    } else {
      clear();
      const isSettled = phase === "settled" && result;
      void controls.start({
        backgroundColor: isSettled ? COLOR_HEX[result as ColorName] : "rgba(42,42,53,0.65)",
        boxShadow: isSettled
          ? `0 0 70px 10px ${COLOR_GLOW[result as ColorName]}, inset 0 0 30px rgba(255,255,255,0.12)`
          : `0 0 40px 4px ${NEUTRAL_GLOW}`,
        rotate: 0,
        scale: isSettled ? [1.25, 1] : 1,
        transition: { type: "spring", stiffness: 220, damping: 16 },
      });
    }

    return clear;
  }, [phase, result, controls]);

  return (
    <div className="relative grid place-items-center py-2">
      <motion.div
        animate={controls}
        initial={{ backgroundColor: "rgba(42,42,53,0.65)", boxShadow: `0 0 40px 4px ${NEUTRAL_GLOW}` }}
        className="relative grid h-40 w-40 place-items-center rounded-3xl border border-white/10 backdrop-blur-md sm:h-48 sm:w-48"
      >
        {phase === "neutral" && (
          <span className="animate-pulse-soft select-none text-7xl font-black text-white/40">?</span>
        )}
        {phase === "settled" && result && (
          <span
            className="select-none text-lg font-bold uppercase tracking-[0.2em]"
            style={{ color: COLOR_TEXT_ON[result] }}
          >
            {colorLabel(result)}
          </span>
        )}
      </motion.div>
    </div>
  );
}
