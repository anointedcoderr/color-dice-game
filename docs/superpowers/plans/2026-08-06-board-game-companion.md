# Board Game Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-only "Board Game" mode that rolls a trustworthy dice color and tracks turns, streaks, and scores as a companion to a physical board game with hidden colored tiles.

**Architecture:** One new stateless Express endpoint returns a cryptographically-random color. A new Next.js page holds all game state (players, whose turn it is, streaks, remaining tile counts per color) purely in React state, reusing the existing `Dice`, `TapButton`, sound, and UI components. No new database models, no persistence, no `/verify` integration; see `docs/superpowers/specs/2026-08-06-board-game-companion-design.md` for why.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript on the frontend; Express and Node's built-in `crypto` module on the backend. Same monorepo, same conventions as the rest of the app.

**On testing:** This repository has no test runner configured anywhere (`npm run lint` in each app is `tsc --noEmit`, and there is no jest/vitest setup). Introducing one just for this feature would be a disproportionate infrastructure change outside this spec's scope. Verification below instead uses `tsc --noEmit` for type safety plus manual browser/curl checks, the same method already used for this app's most recent feature work.

---

### Task 1: Backend, stateless roll endpoint

**Files:**
- Create: `apps/server/src/routes/board.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Write the route file**

Create `apps/server/src/routes/board.ts`:

```typescript
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
```

- [ ] **Step 2: Register the route**

In `apps/server/src/index.ts`, add the import next to the other route imports:

```typescript
import localRoutes from "./routes/local";
import boardRoutes from "./routes/board";
```

(This goes immediately after the existing `import localRoutes from "./routes/local";` line.)

Then add the route registration next to the other `app.use` calls, immediately after the `/api/local` line:

```typescript
app.use("/api/local", localRoutes); // public — single-screen pass-and-play
app.use("/api/board", boardRoutes); // public, no auth, no persistence
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/server && npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Manually verify the endpoint**

Start the server if it isn't running (`npm run dev --workspace=apps/server`, or via whatever port this session is already using), then:

```bash
curl -s -X POST http://localhost:4500/api/board/roll
```

Expected: a JSON body like `{"color":"blue"}` where the value is one of `red`, `black`, `blue`, `green`, `yellow`, `white`. Run it 8-10 times in a row and confirm the colors vary (not always the same one).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/board.ts apps/server/src/index.ts
git commit -m "Add stateless board game roll endpoint"
```

---

### Task 2: Frontend, the Board Game page

**Files:**
- Create: `apps/web/src/app/board/page.tsx`

This is one cohesive component (setup, playing, and ended steps, same structural shape as `apps/web/src/app/local/page.tsx`). It only compiles and only makes sense as a complete file, so it's written whole rather than built up across several partial saves.

- [ ] **Step 1: Write the complete page**

Create `apps/web/src/app/board/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Dice, type DicePhase } from "@/components/Dice";
import { TapButton } from "@/components/TapButton";
import { Badge, Button, Card, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { COLORS, COLOR_HEX, COLOR_TEXT_ON, colorLabel } from "@/lib/colors";
import type { ColorName } from "@/lib/types";

interface BoardPlayer {
  name: string;
  score: number;
  streak: number;
}

type Step = "setup" | "playing" | "ended";

const ROLL_MS = 2000; // matches Quick Play's roll duration
const REVEAL_MS = 1500; // pause before auto-passing on a dead-colour roll

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeRemaining(value: number): Record<ColorName, number> {
  return Object.fromEntries(COLORS.map((c) => [c, value])) as Record<ColorName, number>;
}

export default function BoardGamePage() {
  const [step, setStep] = useState<Step>("setup");
  const [count, setCount] = useState<2 | 3>(2);
  const [names, setNames] = useState<string[]>(["", "", ""]);
  const [tilesPerColor, setTilesPerColor] = useState(6);

  const [players, setPlayers] = useState<BoardPlayer[]>([]);
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [remaining, setRemaining] = useState<Record<ColorName, number>>(() => makeRemaining(0));
  const [phase, setPhase] = useState<DicePhase>("neutral");
  const [rolledColor, setRolledColor] = useState<ColorName | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Warn before an accidental refresh/navigation loses an in-progress game
  // (nothing here is persisted to the server).
  useEffect(() => {
    if (step !== "playing") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step]);

  function startGame() {
    if (!Number.isInteger(tilesPerColor) || tilesPerColor < 1) {
      setError("Enter at least 1 tile per colour");
      return;
    }
    setError(null);
    setPlayers(
      Array.from({ length: count }, (_, i) => ({
        name: names[i]?.trim() || `Player ${i + 1}`,
        score: 0,
        streak: 0,
      })),
    );
    setRemaining(makeRemaining(tilesPerColor));
    setActivePlayerIndex(0);
    setRolledColor(null);
    setPhase("neutral");
    setStep("playing");
  }

  function passTurn() {
    setPlayers((ps) => ps.map((p, i) => (i === activePlayerIndex ? { ...p, streak: 0 } : p)));
    setActivePlayerIndex((i) => (i + 1) % players.length);
  }

  async function roll() {
    if (busy || phase !== "neutral") return;
    setBusy(true);
    setError(null);
    setPhase("spinning");
    try {
      const [res] = await Promise.all([
        api.post<{ color: ColorName }>("/api/board/roll"),
        sleep(ROLL_MS),
      ]);
      setRolledColor(res.color);
      setPhase("settled");
      setBusy(false);

      if (remaining[res.color] === 0) {
        // Nothing on the board could possibly match: auto-resolve as a miss.
        await sleep(REVEAL_MS);
        passTurn();
        setRolledColor(null);
        setPhase("neutral");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Roll failed");
      setPhase("neutral");
      setBusy(false);
    }
  }

  function confirmMatched() {
    if (busy || !rolledColor) return;
    setBusy(true);
    const color = rolledColor;
    const updatedRemaining = { ...remaining, [color]: remaining[color] - 1 };
    const updatedPlayers = players.map((p, i) =>
      i === activePlayerIndex ? { ...p, score: p.score + 1, streak: p.streak + 1 } : p,
    );
    setRemaining(updatedRemaining);
    setPlayers(updatedPlayers);
    setRolledColor(null);
    setBusy(false);

    const boardEmpty = COLORS.every((c) => updatedRemaining[c] === 0);
    if (boardEmpty) {
      setStep("ended");
    } else {
      setPhase("neutral");
    }
  }

  function confirmMissed() {
    if (busy) return;
    setBusy(true);
    passTurn();
    setRolledColor(null);
    setPhase("neutral");
    setBusy(false);
  }

  function endGame() {
    if (players.some((p) => p.score > 0)) setStep("ended");
    else setStep("setup");
  }

  function newGame() {
    setStep("setup");
    setPlayers([]);
    setRemaining(makeRemaining(0));
    setActivePlayerIndex(0);
    setRolledColor(null);
    setPhase("neutral");
    setError(null);
  }

  // ── SETUP ──────────────────────────────────────────────────────────────
  if (step === "setup") {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Board Game</h1>
          <p className="text-zinc-400">
            Roll the dice, pick from your board. The app tracks turns and score, you tell it what
            happened.
          </p>
        </div>
        <Card className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-300">How many players?</p>
            <div className="flex gap-2">
              {[2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n as 2 | 3)}
                  className={clsx(
                    "flex-1 rounded-xl border px-4 py-3 font-semibold transition",
                    count === n
                      ? "border-indigo-400/60 bg-indigo-500/15 text-white"
                      : "border-white/10 text-zinc-300 hover:bg-white/5",
                  )}
                >
                  {n} players
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-zinc-300">Player names (optional)</p>
            {Array.from({ length: count }).map((_, i) => (
              <Input
                key={i}
                value={names[i] ?? ""}
                onChange={(e) =>
                  setNames((prev) => {
                    const copy = [...prev];
                    copy[i] = e.target.value;
                    return copy;
                  })
                }
                placeholder={`Player ${i + 1}`}
                maxLength={20}
              />
            ))}
          </div>
          <div>
            <Input
              label="Tiles per colour"
              type="number"
              min={1}
              value={tilesPerColor}
              onChange={(e) => setTilesPerColor(Number(e.target.value))}
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Applied evenly across all 6 colours. 6 means 36 tiles total on the board.
            </p>
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <Button onClick={startGame} className="w-full py-3">
            Start game
          </Button>
        </Card>
      </div>
    );
  }

  // ── ENDED ──────────────────────────────────────────────────────────────
  if (step === "ended") {
    const maxScore = Math.max(0, ...players.map((p) => p.score));
    const winners = players.filter((p) => p.score === maxScore);
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Game over</h1>
          <p className="text-zinc-400">
            {winners.length > 1
              ? `${winners.map((w) => w.name).join(" & ")} tie with ${maxScore} correct each!`
              : `${winners[0]?.name ?? "Nobody"} wins with ${maxScore} correct!`}
          </p>
        </div>
        <Card className="space-y-2">
          {[...players]
            .sort((a, b) => b.score - a.score)
            .map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3"
              >
                <span className="font-medium">{p.name}</span>
                <Badge>{p.score} correct</Badge>
              </div>
            ))}
        </Card>
        <div className="flex justify-center gap-3">
          <Button onClick={startGame}>Play again (same players)</Button>
          <Button variant="ghost" onClick={newGame}>
            New players
          </Button>
        </div>
      </div>
    );
  }

  // ── PLAYING ────────────────────────────────────────────────────────────
  const active = players[activePlayerIndex];
  return (
    <div className="mx-auto max-w-lg space-y-6 py-6">
      <Card className="flex flex-wrap items-center justify-center gap-2">
        {players.map((p, i) => (
          <div
            key={p.name + i}
            className={clsx(
              "min-w-[100px] rounded-xl border p-3 text-center transition",
              i === activePlayerIndex
                ? "border-indigo-400/60 bg-indigo-500/15"
                : "border-white/10 bg-black/20",
            )}
          >
            <p className="text-sm font-semibold">{p.name}</p>
            <p className="text-2xl font-extrabold text-indigo-200">{p.score}</p>
            {p.streak > 0 && (
              <p className="text-xs font-bold text-amber-300">streak {p.streak}</p>
            )}
          </div>
        ))}
      </Card>

      <Card className="flex flex-col items-center gap-4 py-8">
        <Dice phase={phase} result={rolledColor} />

        {phase === "settled" && rolledColor && remaining[rolledColor] > 0 ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-center text-lg text-zinc-200">
              Rolled{" "}
              <span
                className="rounded-md px-2 py-0.5 font-bold"
                style={{
                  backgroundColor: COLOR_HEX[rolledColor],
                  color: COLOR_TEXT_ON[rolledColor],
                }}
              >
                {colorLabel(rolledColor)}
              </span>
              . Did {active?.name} pick a {colorLabel(rolledColor).toLowerCase()} tile?
            </p>
            <div className="flex gap-3">
              <Button onClick={confirmMatched} disabled={busy}>
                Matched
              </Button>
              <Button variant="danger" onClick={confirmMissed} disabled={busy}>
                Missed
              </Button>
            </div>
          </div>
        ) : phase === "settled" && rolledColor ? (
          <p className="text-lg text-zinc-200">
            No {colorLabel(rolledColor).toLowerCase()} left on the board. Miss!
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <TapButton disabled={busy || phase !== "neutral"} onTap={roll} label="Roll" />
            <p className="text-sm text-zinc-500">{active?.name}&apos;s turn.</p>
          </div>
        )}
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </Card>

      <Card className="space-y-2">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-zinc-500">
          Tiles left on board
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {COLORS.map((c) => (
            <span
              key={c}
              className={clsx(
                "rounded-lg px-2.5 py-1 text-xs font-bold transition",
                remaining[c] === 0 && "opacity-35",
              )}
              style={{ backgroundColor: COLOR_HEX[c], color: COLOR_TEXT_ON[c] }}
            >
              {colorLabel(c)}: {remaining[c]}
            </span>
          ))}
        </div>
      </Card>

      <div className="text-center">
        <Button variant="ghost" onClick={endGame}>
          End game
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Lint**

Run: `cd apps/web && npx next lint --dir src`
Expected: `✔ No ESLint warnings or errors`

- [ ] **Step 4: Manually verify in the browser**

Start both dev servers (backend and frontend) if not already running. Open `/board` directly (this page has no nav link yet, that's Task 3) and walk through:

1. Setup: pick 2 players, name them, set "Tiles per colour" to `1` (fast to finish), tap "Start game".
2. Playing: tap "Roll". Confirm the dice spins for ~2 seconds with the rattle sound, then settles on a colour.
3. Tap "Matched". Confirm: that player's score becomes 1, a "streak 1" badge appears on their card, the matching colour's chip in the "Tiles left on board" strip drops to 0 and dims, and "Roll" is available again for the *same* player.
4. Roll again. If it lands on the now-depleted colour, confirm it auto-shows "No {colour} left on the board. Miss!" for about 1.5 seconds and then automatically passes the turn (no button needed). If it lands on a different colour, tap "Missed" instead and confirm the turn passes to the other player and the first player's streak badge disappears.
5. Keep playing until every colour's chip reads 0. Confirm it jumps straight to the "Game over" recap without needing to tap "End game", and the winner (or tie) is correct.
6. Start a new game (`tilesPerColor = 6`), roll a couple of times, then tap "End game" mid-game. Confirm it shows the recap with the partial scores.
7. From the setup screen, try entering `0` for tiles per colour and tapping "Start game". Confirm it shows the "Enter at least 1 tile per colour" error and does not proceed.
8. During an in-progress game, try closing or reloading the tab. Confirm the browser shows its native "leave this page?" prompt.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/board/page.tsx
git commit -m "Add Board Game companion mode"
```

---

### Task 3: Navigation and discoverability

**Files:**
- Modify: `apps/web/src/components/Nav.tsx`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Add the nav link**

In `apps/web/src/components/Nav.tsx`, find this line:

```tsx
          <NavLink href="/local" label="Quick Play" active={pathname.startsWith("/local")} />
```

Add a new line immediately after it:

```tsx
          <NavLink href="/local" label="Quick Play" active={pathname.startsWith("/local")} />
          <NavLink href="/board" label="Board Game" active={pathname.startsWith("/board")} />
```

- [ ] **Step 2: Add the homepage CTA**

In `apps/web/src/app/page.tsx`, find this block:

```tsx
          <div className="flex flex-wrap gap-3">
            <Link href="/local">
              <Button className="px-6 py-3 text-base">Play on this device →</Button>
            </Link>
            <Link href={user ? "/lobby" : "/login"}>
              <Button variant="ghost" className="px-6 py-3 text-base">
                Online multiplayer
              </Button>
            </Link>
          </div>
```

Replace it with:

```tsx
          <div className="flex flex-wrap gap-3">
            <Link href="/local">
              <Button className="px-6 py-3 text-base">Play on this device →</Button>
            </Link>
            <Link href="/board">
              <Button variant="subtle" className="px-6 py-3 text-base">
                Board game companion
              </Button>
            </Link>
            <Link href={user ? "/lobby" : "/login"}>
              <Button variant="ghost" className="px-6 py-3 text-base">
                Online multiplayer
              </Button>
            </Link>
          </div>
```

- [ ] **Step 3: Typecheck and lint**

Run: `cd apps/web && npx tsc --noEmit && npx next lint --dir src`
Expected: no typecheck output, `✔ No ESLint warnings or errors` from lint.

- [ ] **Step 4: Manually verify**

In the browser: confirm "Board Game" now appears in the top nav next to "Quick Play" and navigates to `/board`; confirm the homepage now shows a "Board game companion" button next to "Play on this device →" that also navigates to `/board`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Nav.tsx apps/web/src/app/page.tsx
git commit -m "Link the Board Game companion from nav and homepage"
```

---

### Task 4: Full end-to-end pass

No file changes; this is the final checkpoint confirming Tasks 1 to 3 work together as a whole, not just in isolation.

- [ ] **Step 1: Fresh full playthrough**

With both dev servers running, start from the homepage, click through to `/board` via the nav link (not a direct URL this time), and play one complete 3-player game from setup through to the "Game over" recap, using a small `tilesPerColor` (e.g. `2`) to keep it short. Confirm scores, streaks, and the winner/tie announcement are all correct throughout.

- [ ] **Step 2: Confirm no console or server errors**

Check the browser console and the backend terminal output across that full playthrough. Expected: no errors in either.

- [ ] **Step 3: Confirm Quick Play still works unmodified**

Play one quick round of Quick Play (`/local`) end to end. This task didn't touch any Quick Play files, but it's a cheap final check that nothing shared (Dice, TapButton, sound, Nav) regressed.
