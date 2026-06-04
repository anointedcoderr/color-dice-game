"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { Dice, type DicePhase } from "@/components/Dice";
import { TapButton } from "@/components/TapButton";
import { RoundSummary } from "@/components/RoundSummary";
import { Badge, Button, Card, HashChip, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { COLOR_HEX, COLOR_GLOW, COLOR_TEXT_ON, colorLabel } from "@/lib/colors";
import type { ColorName, CompletedPlayer, RoomState, RoomType } from "@/lib/types";

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
interface VerifyData {
  roundId: string;
  roundNumber: number;
  nonce: number;
  serverSeed: string;
  serverSeedHash: string;
  players: {
    userId: string;
    username: string | null;
    playerPosition: number;
    resultColor: ColorName | null;
    finalHash: string | null;
    tapTime: string | null;
  }[];
}

type Step = "setup" | "playing" | "done";

export default function LocalPlayPage() {
  const [step, setStep] = useState<Step>("setup");
  const [count, setCount] = useState<2 | 3>(2);
  const [names, setNames] = useState<string[]>(["", "", ""]);
  const [round, setRound] = useState<LocalRound | null>(null);
  const [phase, setPhase] = useState<DicePhase>("neutral");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RoomState | null>(null);

  const roomType: RoomType = count === 3 ? "three_player" : "two_player";

  const activeSeat = useMemo(
    () => round?.players.find((p) => !p.hasTapped) ?? null,
    [round],
  );

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const players = Array.from({ length: count }, (_, i) => ({
        name: names[i]?.trim() || `Player ${i + 1}`,
      }));
      const r = await api.post<LocalRound>("/api/local/rounds", { roomType, players });
      setRound(r);
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
    setBusy(true);
    setError(null);
    setPhase("spinning");
    try {
      const res = await api.post<{ playerPosition: number; resultColor: ColorName; completed: boolean }>(
        `/api/local/rounds/${round.roundId}/tap`,
        { playerPosition: activeSeat.playerPosition },
      );
      // brief spin for effect before settling
      await new Promise((r) => setTimeout(r, 850));
      setRound((prev) =>
        prev
          ? {
              ...prev,
              players: prev.players.map((p) =>
                p.playerPosition === res.playerPosition
                  ? { ...p, hasTapped: true, resultColor: res.resultColor }
                  : p,
              ),
            }
          : prev,
      );
      setPhase("settled");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tap failed");
      setPhase("neutral");
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (!round) return;
    const remaining = round.players.filter((p) => !p.hasTapped).length;
    if (remaining > 0) {
      setPhase("neutral");
      return;
    }
    // all tapped — fetch fairness data and show the summary
    setBusy(true);
    try {
      const v = await api.get<VerifyData>(`/api/verify/${round.roundId}`);
      const completedSummary: CompletedPlayer[] = v.players.map((p) => ({
        userId: p.userId,
        username: p.username ?? "",
        playerPosition: p.playerPosition,
        resultColor: p.resultColor,
        finalHash: p.finalHash,
        tapTime: p.tapTime,
      }));
      setSummary({
        roomId: null,
        roomType,
        maxPlayers: round.maxPlayers,
        status: "completed",
        roundId: v.roundId,
        roundNumber: v.roundNumber,
        serverSeedHash: v.serverSeedHash,
        serverSeed: v.serverSeed,
        nonce: v.nonce,
        players: [],
        myUserId: null,
        iHaveTapped: true,
        myResult: null,
        error: null,
        completedSummary,
      });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load summary");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep("setup");
    setRound(null);
    setSummary(null);
    setPhase("neutral");
    setError(null);
  }

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (step === "setup") {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Quick Play</h1>
          <p className="text-zinc-400">One device, pass it around. No login needed.</p>
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
          <Button onClick={start} disabled={busy} className="w-full py-3">
            {busy ? "Starting…" : "Start round"}
          </Button>
        </Card>
      </div>
    );
  }

  // ── DONE ───────────────────────────────────────────────────────────────────
  if (step === "done" && summary) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <RoundSummary room={summary} onPlayAgain={reset} />
      </div>
    );
  }

  // ── PLAYING ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-lg space-y-6 py-6">
      <Card className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">Round #{round?.roundNumber}</h1>
          <Badge>{count === 3 ? "3-Player" : "2-Player"}</Badge>
          <Badge className="text-indigo-300">single screen</Badge>
        </div>
        {round?.serverSeedHash && <HashChip label="seed hash" value={round.serverSeedHash} />}
      </Card>

      <div className="grid grid-cols-1 gap-2">
        {round?.players.map((p) => {
          const isActive = activeSeat?.playerPosition === p.playerPosition;
          return (
            <div
              key={p.playerPosition}
              className={clsx(
                "flex items-center justify-between rounded-xl border p-3",
                isActive ? "border-indigo-400/60 bg-indigo-500/10" : "border-white/10 bg-black/20",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-xs font-bold">
                  {p.playerPosition}
                </span>
                <span className="font-medium">{p.name}</span>
                {isActive && <span className="text-xs text-indigo-300">← your turn</span>}
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
        <Dice phase={phase} result={activeSeat?.resultColor ?? null} />
        {phase === "settled" ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-zinc-300">
              {activeSeat
                ? `${activeSeat.name} got ${activeSeat.resultColor ? colorLabel(activeSeat.resultColor) : ""}!`
                : "Revealed!"}
            </p>
            <Button onClick={next} disabled={busy}>
              {round && round.players.every((p) => p.hasTapped) ? "See results →" : "Next player →"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <TapButton
              disabled={busy || !activeSeat}
              onTap={tap}
              label={activeSeat ? `${activeSeat.name} — Tap to Play` : "Tap to Play"}
            />
            <p className="text-sm text-zinc-500">Pass the device to the player whose turn it is.</p>
          </div>
        )}
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </Card>

      <div className="text-center">
        <Button variant="ghost" onClick={reset}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
