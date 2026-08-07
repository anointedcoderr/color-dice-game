# Board Game Early Win and Winner Celebration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End a Board Game round the moment a player has mathematically clinched the win (not just when the board empties), and celebrate a sole winner with a balloons-and-confetti burst plus a cheer sound.

**Architecture:** A pure arithmetic check added to the existing `confirmMatched()` handler (no new state machine), a new self-contained `Celebration` component driven entirely by Framer Motion (already a dependency), and one new synthesized sound function added to the existing `sound.ts` module (same Web Audio pattern already used there, no audio files).

**Tech Stack:** React/TypeScript (Next.js App Router), Framer Motion, Web Audio API. No backend changes, no new dependencies, no database changes.

**On testing:** This repository has no test runner configured anywhere (confirmed again for this plan: no jest/vitest in either `apps/web` or `apps/server`). Verification below uses `tsc --noEmit`, `next lint`, and manual browser checks, matching every other plan in this repo.

---

### Task 1: Cheer sound

**Files:**
- Modify: `apps/web/src/lib/sound.ts`

- [ ] **Step 1: Add the tone helper and `playCheer()`**

Append this to the end of `apps/web/src/lib/sound.ts` (after the existing `playDiceLand` function, nothing else in the file changes):

```typescript

interface ToneOptions {
  freq: number;
  gain: number;
  duration: number;
}

function tone(context: AudioContext, time: number, { freq, gain, duration }: ToneOptions): void {
  try {
    const osc = context.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;

    const gainNode = context.createGain();
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(gain, time + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gainNode).connect(context.destination);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  } catch {
    // Same rationale as clack(): never let a sound glitch break the celebration.
  }
}

/** A short triumphant ascending chime. Play once, when a game ends with a sole winner. */
export function playCheer(): void {
  const context = getContext();
  if (!context) return;
  const now = context.currentTime;
  // A bright ascending arpeggio (C5, E5, G5, C6), the last note held longer
  // for a "ta-da" landing.
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const time = now + i * 0.09;
    const duration = i === notes.length - 1 ? 0.5 : 0.16;
    tone(context, time, { freq, gain: 0.22, duration });
  });
}
```

This uses the same `getContext()` already defined earlier in the file (the same lazily-created, try/catch-guarded `AudioContext` the dice sounds already use); do not duplicate it.

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Lint**

Run: `cd apps/web && npx next lint --dir src`
Expected: `✔ No ESLint warnings or errors`

- [ ] **Step 4: Note on verification**

`playCheer()` isn't called from anywhere yet (Task 3 wires it up), so there's nothing to hear yet. Typecheck and lint are the full verification for this task; the actual sound is confirmed by ear in Task 3's manual check.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/sound.ts
git commit -m "Add a synthesized cheer sound for the winner celebration"
```

---

### Task 2: Celebration component

**Files:**
- Create: `apps/web/src/components/Celebration.tsx`

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/Celebration.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";
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
 */
export function Celebration() {
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

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
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
```

`COLORS` and `COLOR_HEX` are the same shared color tokens already used throughout the app (`apps/web/src/lib/colors.ts`), reused here rather than inventing new colors. The keyframe-array pattern for `animate` (e.g. `opacity: [1, 1, 0]`) is the same style already used in `apps/web/src/components/Dice.tsx` (e.g. `scale: [1, 1.12, 1]`), so this matches established Framer Motion usage in this codebase.

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Lint**

Run: `cd apps/web && npx next lint --dir src`
Expected: `✔ No ESLint warnings or errors`

- [ ] **Step 4: Note on verification**

`Celebration` isn't mounted anywhere yet (Task 3 wires it up), so there's nothing to look at yet. Typecheck and lint are the full verification for this task; the actual visual is confirmed in Task 3's manual check.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Celebration.tsx
git commit -m "Add the balloons-and-confetti Celebration component"
```

---

### Task 3: Wire the win-clinch check and celebration into the Board Game page

**Files:**
- Modify: `apps/web/src/app/board/page.tsx`

This task makes five changes to the same file. Apply them in order; the file only makes sense once all five are in.

- [ ] **Step 1: Update imports**

Find:
```tsx
import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Dice, type DicePhase } from "@/components/Dice";
import { TapButton } from "@/components/TapButton";
import { Badge, Button, Card, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { COLORS, COLOR_HEX, COLOR_TEXT_ON, colorLabel } from "@/lib/colors";
import type { ColorName } from "@/lib/types";
```

Replace with:
```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Celebration } from "@/components/Celebration";
import { Dice, type DicePhase } from "@/components/Dice";
import { TapButton } from "@/components/TapButton";
import { Badge, Button, Card, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { COLORS, COLOR_HEX, COLOR_TEXT_ON, colorLabel } from "@/lib/colors";
import { playCheer } from "@/lib/sound";
import type { ColorName } from "@/lib/types";
```

- [ ] **Step 2: Add celebration state and shared winner/score derivation**

Find:
```tsx
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ended = useRef(false);
  // Bumped by startGame() every time a new game begins. A roll captures the
  // id of the game it belongs to and compares it at each resume point: this
  // catches "end game, then immediately start a new one before the old roll
  // resolves", which `ended` alone can't - starting a new game must clear
  // `ended` back to false for the new game's own rolls to work, and that
  // same reset would otherwise un-cancel a still-in-flight roll from the
  // game that was just abandoned.
  const gameId = useRef(0);

  // Warn before an accidental refresh/navigation loses an in-progress game
```

Replace with:
```tsx
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ended = useRef(false);
  // Bumped by startGame() every time a new game begins. A roll captures the
  // id of the game it belongs to and compares it at each resume point: this
  // catches "end game, then immediately start a new one before the old roll
  // resolves", which `ended` alone can't - starting a new game must clear
  // `ended` back to false for the new game's own rolls to work, and that
  // same reset would otherwise un-cancel a still-in-flight roll from the
  // game that was just abandoned.
  const gameId = useRef(0);

  const [showCelebration, setShowCelebration] = useState(false);
  const maxScore = useMemo(() => Math.max(0, ...players.map((p) => p.score)), [players]);
  const winners = useMemo(() => players.filter((p) => p.score === maxScore), [players, maxScore]);

  // Warn before an accidental refresh/navigation loses an in-progress game
```

(Only the block between `const gameId = useRef(0);` and the next comment is new; everything else shown is unchanged context to locate the right spot.)

- [ ] **Step 3: Add the celebration-trigger effect**

Find:
```tsx
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [step]);

  function startGame() {
```

Replace with:
```tsx
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [step]);

  // Celebrate once, only for a sole winner (a tie has no one to celebrate for).
  // The cleanup always resets showCelebration, not just the timer: if the
  // group clicks "Play again" mid-celebration (before the 3s timeout fires),
  // this is what stops it from staying stuck true into whatever comes next.
  useEffect(() => {
    if (step !== "ended" || winners.length !== 1) return;
    playCheer();
    setShowCelebration(true);
    const timer = setTimeout(() => setShowCelebration(false), 3000);
    return () => {
      clearTimeout(timer);
      setShowCelebration(false);
    };
  }, [step, winners]);

  function startGame() {
```

- [ ] **Step 4: Add the win-clinch check to `confirmMatched()`**

Find:
```tsx
  function confirmMatched() {
    if (!rolledColor) return;
    const color = rolledColor;
    const updatedRemaining = { ...remaining, [color]: Math.max(0, remaining[color] - 1) };
    const updatedPlayers = players.map((p, i) =>
      i === activePlayerIndex ? { ...p, score: p.score + 1, streak: p.streak + 1 } : p,
    );
    setRemaining(updatedRemaining);
    setPlayers(updatedPlayers);
    setRolledColor(null);

    const boardEmpty = COLORS.every((c) => updatedRemaining[c] === 0);
    if (boardEmpty) {
      setStep("ended");
    } else {
      setPhase("neutral");
    }
  }
```

Replace with:
```tsx
  function confirmMatched() {
    if (!rolledColor) return;
    const color = rolledColor;
    const updatedRemaining = { ...remaining, [color]: Math.max(0, remaining[color] - 1) };
    const updatedPlayers = players.map((p, i) =>
      i === activePlayerIndex ? { ...p, score: p.score + 1, streak: p.streak + 1 } : p,
    );
    setRemaining(updatedRemaining);
    setPlayers(updatedPlayers);
    setRolledColor(null);

    // A player has clinched the win the moment no rival could catch up even
    // if every tile still on the board went to them, so the game doesn't
    // have to wait for the board to actually empty.
    const boardRemaining = COLORS.reduce((sum, c) => sum + updatedRemaining[c], 0);
    const activeScore = updatedPlayers[activePlayerIndex].score;
    const maxOtherScore = Math.max(
      0,
      ...updatedPlayers.filter((_, i) => i !== activePlayerIndex).map((p) => p.score),
    );
    const clinched = activeScore > maxOtherScore + boardRemaining;
    if (boardRemaining === 0 || clinched) {
      setStep("ended");
    } else {
      setPhase("neutral");
    }
  }
```

- [ ] **Step 5: Reset the celebration flag when a game (re)starts**

`startGame()` and `newGame()` already explicitly reset every other piece of per-game state (`setRolledColor(null)`, `setPhase("neutral")`, etc.) rather than relying on side effects to do it. Add `showCelebration` to that same explicit list in both, for the same reason and to match that established pattern. (The effect's cleanup in Step 3 also resets it reactively; this is a second, more direct line of defense that costs nothing and matches how every other reset in these two functions already works.)

Find:
```tsx
    setRemaining(makeRemaining(tilesPerColor));
    setActivePlayerIndex(0);
    setRolledColor(null);
    setPhase("neutral");
    setStep("playing");
  }
```

Replace with:
```tsx
    setRemaining(makeRemaining(tilesPerColor));
    setActivePlayerIndex(0);
    setRolledColor(null);
    setPhase("neutral");
    setShowCelebration(false);
    setStep("playing");
  }
```

Find:
```tsx
  function newGame() {
    ended.current = true;
    setStep("setup");
    setPlayers([]);
    setRemaining(makeRemaining(0));
    setActivePlayerIndex(0);
    setRolledColor(null);
    setPhase("neutral");
    setError(null);
  }
```

Replace with:
```tsx
  function newGame() {
    ended.current = true;
    setStep("setup");
    setPlayers([]);
    setRemaining(makeRemaining(0));
    setActivePlayerIndex(0);
    setRolledColor(null);
    setPhase("neutral");
    setShowCelebration(false);
    setError(null);
  }
```

- [ ] **Step 6: Use the shared winner derivation and mount the celebration**

Find:
```tsx
  // ── ENDED ──────────────────────────────────────────────────────────────
  if (step === "ended") {
    const maxScore = Math.max(0, ...players.map((p) => p.score));
    const winners = players.filter((p) => p.score === maxScore);
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <div className="text-center">
```

Replace with:
```tsx
  // ── ENDED ──────────────────────────────────────────────────────────────
  if (step === "ended") {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        {showCelebration && <Celebration />}
        <div className="text-center">
```

(The rest of the "ended" block, the recap card and the "Play again"/"New players" buttons, is unchanged; it already references `maxScore` and `winners`, which now come from the top-level `useMemo`s added in Step 2 instead of being recomputed locally.)

- [ ] **Step 7: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 8: Lint**

Run: `cd apps/web && npx next lint --dir src`
Expected: `✔ No ESLint warnings or errors`

- [ ] **Step 9: Manually verify in the browser**

Start both dev servers if not already running (backend on port 4500, frontend on port 3500 per `apps/server/.env` and `apps/web/.env.local`; check with `curl -s http://localhost:4500/health` and `curl -s -o /dev/null -w "%{http_code}" http://localhost:3500` before starting new ones). Navigate to `/board`.

1. Setup: 2 players, set "Tiles per colour" to `2` (12 tiles total, quick to finish either way).
2. Play normally: tap Roll, then Matched or Missed as the roll dictates (matches don't pass the turn, so the same player can keep rolling; misses and the auto-resolved dead-colour case do pass it). After every "Matched", read the three numbers on screen, the two players' scores and the sum of the "Tiles left on board" strip, and check them against the rule: the active player has clinched the win the moment their score exceeds (the other player's score plus however many tiles are still shown as left on the board). The very first time that becomes true, confirm the game immediately jumps to "Game over" without waiting for every colour to reach 0.
3. On that "Game over" screen, confirm: balloons rise from the bottom and fade out, confetti bursts from the upper-middle and scatters down, and a bright ascending chime plays, all starting at the same moment the screen appears. Confirm everything is gone after about 3 seconds (no lingering shapes, no stuck overlay blocking the "Play again"/"New players" buttons, click one to confirm it's actually clickable while or after the celebration plays).
4. Start a fresh game (`tilesPerColor = 2` again) and this time force the other ending path: keep playing until every colour's "Tiles left on board" chip reads exactly 0 without either player ever having clinched early (this happens naturally if the scores stay close). Confirm the recap still shows correctly and the celebration still plays for whichever player has the strictly higher score.
5. Specifically produce a tie (two players finish with equal scores when the board empties, achievable by deliberately alternating who matches so both end up even). Confirm the recap shows the "X & Y tie with N correct each!" message and that no celebration (no balloons, no confetti, no cheer sound) plays for a tie.
6. Start another fresh game. This time, get a sole winner and immediately (within a second or two, well before the 3-second auto-hide) click "Play again (same players)" while the celebration is still visibly playing. Confirm the new game starts cleanly with the balloons/confetti gone, not frozen mid-animation. Then play that new game to a tie. Confirm no celebration plays for that tie, this is the specific case the mid-celebration reset in Step 5 exists to cover, so it is worth checking directly rather than assuming it works.
7. From any "Game over" screen, click "Play again (same players)" normally (celebration already finished) and confirm a fresh win in the new game still triggers its own celebration (it is not a one-time-per-session flag).

If you started the dev servers yourself, stop them when done.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/board/page.tsx
git commit -m "End the game on a clinched win, celebrate a sole winner"
```

---

### Task 4: Full pass

No file changes; final checkpoint confirming Tasks 1 to 3 work together, not just in isolation.

- [ ] **Step 1: Fresh full playthrough**

From `/board`'s setup screen, play one complete 2-player game with a slightly larger `tilesPerColor` (e.g. `4`, matching the user's original 24-tile example) all the way through, using whatever mix of Matched/Missed the real rolls produce. Confirm the game ends at the correct point (early clinch or board-empty, whichever comes first for that particular playthrough) and the celebration behaves correctly for the outcome (plays for a sole winner, doesn't for a tie).

- [ ] **Step 2: Confirm no console or server errors**

Check the browser console and the backend terminal output across that full playthrough. Expected: no errors in either.

- [ ] **Step 3: Confirm the rest of the app is unaffected**

Play one quick round of Quick Play (`/local`) end to end. This feature touched no shared files (`Dice.tsx`, `TapButton.tsx`, `sound.ts`'s existing exports, `colors.ts`), so this is a cheap final check that nothing regressed.
