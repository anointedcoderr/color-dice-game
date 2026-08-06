"use client";

import { useEffect, useRef, useState } from "react";
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

  // beforeunload only covers real browser navigation (reload/close/URL bar).
  // Next.js <Link> client-side navigation never fires it, so intercept clicks
  // on in-app links too while a game is in progress.
  useEffect(() => {
    if (step !== "playing") return;
    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement)?.closest("a[href]");
      if (!link) return;
      if (link.getAttribute("href") === window.location.pathname) return; // same page, nothing to lose
      if (!window.confirm("Leave this game? Your progress will be lost.")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [step]);

  function startGame() {
    if (!Number.isInteger(tilesPerColor) || tilesPerColor < 1 || tilesPerColor > 50) {
      setError("Enter between 1 and 50 tiles per colour");
      return;
    }
    setError(null);
    setBusy(false); // release a still-disabled Roll button left over from a just-abandoned game
    ended.current = false;
    gameId.current += 1;
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
    const myGame = gameId.current;
    setBusy(true);
    setError(null);
    setPhase("spinning");
    try {
      const [res] = await Promise.all([
        api.post<{ color: ColorName }>("/api/board/roll"),
        sleep(ROLL_MS),
      ]);
      if (ended.current || gameId.current !== myGame) {
        setBusy(false);
        return; // "End game" was clicked mid-roll (or a new game already started); the result is real but no longer ours to show
      }
      setRolledColor(res.color);
      setPhase("settled");
      setBusy(false);

      if ((remaining[res.color] ?? 0) === 0) {
        // Nothing on the board could possibly match: auto-resolve as a miss.
        await sleep(REVEAL_MS);
        if (ended.current || gameId.current !== myGame) return;
        passTurn();
        setRolledColor(null);
        setPhase("neutral");
      }
    } catch (e) {
      if (ended.current || gameId.current !== myGame) {
        setBusy(false);
        return; // this roll no longer belongs to the current game; don't surface its error there
      }
      setError(e instanceof Error ? e.message : "Roll failed");
      setPhase("neutral");
      setBusy(false);
    }
  }

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

  function confirmMissed() {
    passTurn();
    setRolledColor(null);
    setPhase("neutral");
  }

  function endGame() {
    ended.current = true;
    if (players.some((p) => p.score > 0)) setStep("ended");
    else newGame();
  }

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
              max={50}
              value={tilesPerColor}
              onChange={(e) => setTilesPerColor(Number(e.target.value))}
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Applied evenly across all 6 colours. 6 means 36 tiles total on the board.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-rose-400">
              {error}
            </p>
          )}
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
            .map((p, i) => (
              <div
                key={p.name + i}
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

        {phase === "settled" && rolledColor && (remaining[rolledColor] ?? 0) > 0 ? (
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
        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}
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
