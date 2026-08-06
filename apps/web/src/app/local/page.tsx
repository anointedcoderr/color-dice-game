"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Dice, type DicePhase } from "@/components/Dice";
import { TapButton } from "@/components/TapButton";
import { Badge, Button, Card, HashChip, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { COLOR_HEX, COLOR_GLOW, COLOR_TEXT_ON, colorLabel } from "@/lib/colors";
import type { ColorName, RoomType } from "@/lib/types";

interface LocalSeat {
  playerPosition: number;
  name: string;
  hasTapped: boolean;
  resultColor: ColorName | null;
}
interface LocalRound {
  roundId: string;
  roundNumber: number;
  roomType: RoomType;
  maxPlayers: number;
  nonce: number;
  serverSeedHash: string;
  players: LocalSeat[];
}
interface SessionRound {
  roundIndex: number;
  roundId: string;
  players: { position: number; name: string; color: ColorName | null }[];
}

type Step = "setup" | "playing" | "ended";
type Revealed = { position: number; name: string; color: ColorName };

const ROLL_MS = 2000; // how long the dice visibly rolls before revealing
const REVEAL_MS = 1500; // how long the result stays on screen before auto-continuing

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function LocalPlayPage() {
  const [step, setStep] = useState<Step>("setup");
  const [count, setCount] = useState<2 | 3>(2);
  const [names, setNames] = useState<string[]>(["", "", ""]);

  const [round, setRound] = useState<LocalRound | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<DicePhase>("neutral");
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [history, setHistory] = useState<SessionRound[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ended = useRef(false);
  // Bumped by startRound() every time a round is (re)started. A pending
  // tap()/startRound() call captures the id it belongs to and compares it at
  // each resume point: this catches "end game, then immediately start a new
  // one before the old request resolves", which `ended` alone can't - a new
  // start must clear `ended` back to false for its own request to work, and
  // that same reset would otherwise un-cancel a still-in-flight request from
  // the round/game that was just abandoned.
  const gameId = useRef(0);

  const roomType: RoomType = count === 3 ? "three_player" : "two_player";
  const activeSeat = useMemo(() => round?.players.find((p) => !p.hasTapped) ?? null, [round]);
  const highlightPos = phase === "settled" ? revealed?.position : activeSeat?.playerPosition;

  async function startRound(idx: number) {
    setError(null);
    setBusy(true);
    ended.current = false;
    gameId.current += 1;
    const myGame = gameId.current;
    try {
      const players = Array.from({ length: count }, (_, i) => ({
        name: names[i]?.trim() || `Player ${i + 1}`,
      }));
      const r = await api.post<LocalRound>("/api/local/rounds", { roomType, players });
      if (ended.current || gameId.current !== myGame) return; // superseded while this request was in flight
      setRound(r);
      setRoundIndex(idx);
      setRevealed(null);
      setPhase("neutral");
      setStep("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start round");
    } finally {
      setBusy(false);
    }
  }

  async function tap() {
    if (!round || !activeSeat || busy || phase !== "neutral") return;
    const seat = activeSeat;
    const myGame = gameId.current;
    setBusy(true);
    setError(null);
    setPhase("spinning");
    try {
      // Roll for a fixed, predictable duration regardless of network speed:
      // never reveal before the real result arrives, never linger after it does.
      const [res] = await Promise.all([
        api.post<{ playerPosition: number; resultColor: ColorName; completed: boolean }>(
          `/api/local/rounds/${round.roundId}/tap`,
          { playerPosition: seat.playerPosition },
        ),
        sleep(ROLL_MS),
      ]);
      if (ended.current || gameId.current !== myGame) {
        setBusy(false);
        return; // "End game" was clicked mid-roll (or a new round already started); the result is real but no longer ours to show
      }
      const updatedPlayers = round.players.map((p) =>
        p.playerPosition === res.playerPosition
          ? { ...p, hasTapped: true, resultColor: res.resultColor }
          : p,
      );
      setRound({ ...round, players: updatedPlayers });
      setRevealed({ position: seat.playerPosition, name: seat.name, color: res.resultColor });
      setPhase("settled");

      // Record the finished round for the end-of-game recap (no interruption).
      if (res.completed) {
        setHistory((h) => [
          ...h,
          {
            roundIndex,
            roundId: round.roundId,
            players: updatedPlayers.map((p) => ({
              position: p.playerPosition,
              name: p.name,
              color: p.resultColor,
            })),
          },
        ]);
      }

      // Let the result sit on screen briefly, then keep the game going on its
      // own: next player's turn, or straight into a new round. Only "End game"
      // stops it.
      await sleep(REVEAL_MS);
      if (ended.current || gameId.current !== myGame) return;

      if (res.completed) {
        await startRound(roundIndex + 1);
      } else {
        setRevealed(null);
        setPhase("neutral");
        setBusy(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tap failed");
      setPhase("neutral");
      setBusy(false);
    }
  }

  function endGame() {
    ended.current = true;
    if (history.length > 0) setStep("ended");
    else newGame();
  }

  function newGame() {
    ended.current = true;
    setStep("setup");
    setRound(null);
    setRevealed(null);
    setHistory([]);
    setRoundIndex(0);
    setPhase("neutral");
    setError(null);
  }

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (step === "setup") {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Quick Play</h1>
          <p className="text-zinc-400">One device, pass it around. Roll round after round.</p>
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
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <Button onClick={() => startRound(1)} disabled={busy} className="w-full py-3">
            {busy ? "Starting…" : "Start game"}
          </Button>
        </Card>
      </div>
    );
  }

  // ── ENDED: session recap ─────────────────────────────────────────────────────
  if (step === "ended") {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Game over</h1>
          <p className="text-zinc-400">
            {history.length} {history.length === 1 ? "round" : "rounds"} played
          </p>
        </div>
        <Card className="space-y-3">
          {history.map((r) => (
            <div key={r.roundId} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-300">Round {r.roundIndex}</p>
                <Link
                  href={`/verify?roundId=${r.roundId}`}
                  className="text-xs text-indigo-300 hover:underline"
                >
                  Verify
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.players.map((p) => (
                  <span
                    key={p.position}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-bold"
                    style={{
                      backgroundColor: p.color ? COLOR_HEX[p.color] : "#2A2A35",
                      color: p.color ? COLOR_TEXT_ON[p.color] : "#fff",
                    }}
                  >
                    {p.name}: {p.color ? colorLabel(p.color) : "—"}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </Card>
        <div className="flex justify-center gap-3">
          <Button onClick={() => startRound(1)}>Play again (same players)</Button>
          <Button variant="ghost" onClick={newGame}>
            New players
          </Button>
        </div>
      </div>
    );
  }

  // ── PLAYING ──────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-lg space-y-6 py-6">
      <Card className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">Round #{roundIndex}</h1>
          <Badge>{count === 3 ? "3-Player" : "2-Player"}</Badge>
          <Badge className="text-indigo-300">single screen</Badge>
        </div>
        {round?.serverSeedHash && <HashChip label="seed hash" value={round.serverSeedHash} />}
      </Card>

      <div className="grid grid-cols-1 gap-2">
        {round?.players.map((p) => {
          const isHighlighted = highlightPos === p.playerPosition;
          return (
            <div
              key={p.playerPosition}
              className={clsx(
                "flex items-center justify-between rounded-xl border p-3 transition",
                isHighlighted ? "border-indigo-400/60 bg-indigo-500/10" : "border-white/10 bg-black/20",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-xs font-bold">
                  {p.playerPosition}
                </span>
                <span className="font-medium">{p.name}</span>
                {isHighlighted && phase !== "settled" && (
                  <span className="text-xs text-indigo-300">← your turn</span>
                )}
              </div>
              {p.resultColor ? (
                <span
                  className="rounded-lg px-3 py-1 text-sm font-bold"
                  style={{
                    backgroundColor: COLOR_HEX[p.resultColor],
                    color: COLOR_TEXT_ON[p.resultColor],
                    boxShadow: `0 0 16px 1px ${COLOR_GLOW[p.resultColor]}`,
                  }}
                >
                  {colorLabel(p.resultColor)}
                </span>
              ) : (
                <span className="text-sm text-zinc-500">Waiting…</span>
              )}
            </div>
          );
        })}
      </div>

      <Card className="flex flex-col items-center gap-5 py-8">
        <Dice phase={phase} result={revealed?.color ?? null} />
        {phase === "settled" && revealed ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-lg text-zinc-200">
              <span className="font-semibold">{revealed.name}</span> got{" "}
              <span
                className="rounded-md px-2 py-0.5 font-bold"
                style={{ backgroundColor: COLOR_HEX[revealed.color], color: COLOR_TEXT_ON[revealed.color] }}
              >
                {colorLabel(revealed.color)}
              </span>
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <TapButton
              disabled={busy || !activeSeat}
              onTap={tap}
              label={activeSeat ? `${activeSeat.name}: Play` : "Play"}
            />
            <p className="text-sm text-zinc-500">Pass the device to the player whose turn it is.</p>
          </div>
        )}
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </Card>

      <div className="text-center">
        <Button variant="ghost" onClick={endGame}>
          End game
        </Button>
      </div>
    </div>
  );
}
