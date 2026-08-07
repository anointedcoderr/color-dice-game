"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { COLORS, COLOR_HEX } from "@/lib/colors";

const BALLOON_COUNT = 8;
const CONFETTI_COUNT = 36;

interface Balloon {
  id: number;
  left: number;
  color: string;
  delay: number;
  duration: number;
}

interface ConfettiPiece {
  id: number;
  color: string;
  x: number;
  y: number;
  rotate: number;
  delay: number;
}

/**
 * A one-shot balloons-and-confetti burst. Renders nothing interactive;
 * mount it conditionally and unmount it again after a few seconds from
 * the caller (see board/page.tsx's showCelebration state).
 * Respects prefers-reduced-motion and renders nothing if set.
 *
 * The randomised layout is generated once per mount (Math.random() runs
 * during render), so this must only ever be mounted client-side after the
 * triggering condition is known, never unconditionally or during SSR.
 *
 * The longest balloon (duration + delay, up to ~3.6s) can outlast the
 * page's ~3s unmount timeout, which is fine: by then it has already eased
 * past the top of the viewport. If either number changes, recheck that.
 */
export function Celebration() {
  const shouldReduceMotion = useReducedMotion();

  const balloons = useMemo<Balloon[]>(
    () =>
      Array.from({ length: BALLOON_COUNT }, (_, i) => ({
        id: i,
        left: 8 + Math.random() * 84,
        color: COLOR_HEX[COLORS[i % COLORS.length]],
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 0.8,
      })),
    [],
  );

  const confetti = useMemo<ConfettiPiece[]>(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const distance = 80 + Math.random() * 160;
        return {
          id: i,
          color: COLOR_HEX[COLORS[i % COLORS.length]],
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance + 220, // biased downward, like gravity
          rotate: Math.random() * 720 - 360,
          delay: Math.random() * 0.25,
        };
      }),
    [],
  );

  if (shouldReduceMotion) {
    return null;
  }

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {balloons.map((b) => (
        <motion.div
          key={b.id}
          className="absolute bottom-0 h-10 w-8 rounded-full"
          style={{ left: `${b.left}%`, backgroundColor: b.color }}
          initial={{ y: 0, opacity: 1 }}
          animate={{ y: "-110vh", opacity: [1, 1, 0] }}
          transition={{ duration: b.duration, delay: b.delay, ease: "easeOut" }}
        >
          <span
            className="absolute left-1/2 top-full h-8 w-px -translate-x-1/2"
            style={{ backgroundColor: "rgba(255,255,255,0.35)" }}
          />
        </motion.div>
      ))}
      {confetti.map((c) => (
        <motion.div
          key={c.id}
          className="absolute left-1/2 top-1/3 h-2.5 w-2.5"
          style={{ backgroundColor: c.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: c.x, y: c.y, opacity: [1, 1, 0], rotate: c.rotate }}
          transition={{ duration: 1.8, delay: c.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
