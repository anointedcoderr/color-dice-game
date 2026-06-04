"use client";

import { useParams, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Dice, type DicePhase } from "@/components/Dice";
import { TapButton } from "@/components/TapButton";
import { PlayerCard } from "@/components/PlayerCard";
import { RoundSummary } from "@/components/RoundSummary";
import { Badge, Button, Card, HashChip, Spinner } from "@/components/ui";
import { useSocket } from "@/lib/socket-context";

function RoomInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { room, tap, connected, reset } = useSocket();

  const id = params?.id;
  const live = room.roomId === id;

  if (!live) {
    return (
      <Card className="mx-auto mt-10 max-w-md space-y-4 text-center">
        <p className="text-zinc-300">This room isn’t active in your current session.</p>
        <p className="text-sm text-zinc-500">
          Rooms are matchmade from the lobby. Head back to find a new game.
        </p>
        <Button onClick={() => router.push("/lobby")}>Back to lobby</Button>
      </Card>
    );
  }

  const myResult = room.myResult;
  const phase: DicePhase =
    room.status === "completed"
      ? myResult
        ? "settled"
        : "neutral"
      : room.iHaveTapped
        ? myResult
          ? "settled"
          : "spinning"
        : "neutral";

  const joined = room.players.length;
  const isWaitingToFill = room.status === "waiting";
  const tapDisabled = !connected || room.status !== "active" || room.iHaveTapped;

  const playAgain = () => {
    reset();
    router.push("/lobby");
  };

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">
            Round {room.roundNumber ? `#${room.roundNumber}` : "—"}
          </h1>
          <Badge>{room.roomType === "three_player" ? "3-Player" : "2-Player"}</Badge>
          <Badge
            className={clsx(
              room.status === "active" && "border-indigo-400/40 text-indigo-300",
              room.status === "completed" && "border-emerald-400/40 text-emerald-300",
              room.status === "waiting" && "text-amber-300",
            )}
          >
            {room.status}
          </Badge>
        </div>
        {room.serverSeedHash && (
          <HashChip label="seed hash" value={room.serverSeedHash} />
        )}
      </Card>

      {/* Players */}
      <div
        className={clsx(
          "grid gap-3",
          room.maxPlayers === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {room.players.map((p) => (
          <PlayerCard key={p.userId} player={p} isMe={p.userId === room.myUserId} />
        ))}
        {/* placeholders for unfilled seats while waiting */}
        {isWaitingToFill &&
          Array.from({ length: Math.max(0, room.maxPlayers - joined) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="grid place-items-center rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-500"
            >
              Waiting for player…
            </div>
          ))}
      </div>

      {/* Dice + action / summary */}
      {room.status === "completed" ? (
        <RoundSummary room={room} onPlayAgain={playAgain} />
      ) : (
        <Card className="flex flex-col items-center gap-6 py-8">
          <Dice phase={phase} result={myResult} />

          {isWaitingToFill ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="flex items-center gap-2 text-zinc-300">
                <Spinner /> Waiting for players… ({joined}/{room.maxPlayers})
              </span>
              <p className="text-sm text-zinc-500">The round begins automatically when full.</p>
            </div>
          ) : room.iHaveTapped ? (
            <div className="text-center">
              {myResult ? (
                <p className="text-zinc-300">
                  Your colour is in. Waiting for other players to tap…
                </p>
              ) : (
                <p className="text-zinc-300">Revealing your colour…</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <TapButton disabled={tapDisabled} onTap={tap} />
              <p className="text-sm text-zinc-500">One tap. The dice decides your colour.</p>
            </div>
          )}

          {room.error && <p className="text-sm text-rose-400">{room.error}</p>}
        </Card>
      )}

      <div className="text-center">
        <Button variant="ghost" onClick={playAgain}>
          Leave room
        </Button>
      </div>
    </div>
  );
}

export default function RoomPage() {
  return (
    <ProtectedRoute>
      <RoomInner />
    </ProtectedRoute>
  );
}
