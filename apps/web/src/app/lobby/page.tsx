"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, Spinner } from "@/components/ui";
import { useSocket } from "@/lib/socket-context";
import type { RoomType } from "@/lib/types";

function LobbyInner() {
  const router = useRouter();
  const { joinRoom, room, connected } = useSocket();
  const error = room.error;
  const [searching, setSearching] = useState<RoomType | null>(null);

  useEffect(() => {
    if (searching && room.roomId) {
      router.push(`/room/${room.roomId}`);
    }
  }, [searching, room.roomId, router]);

  const pick = (roomType: RoomType) => {
    if (!connected) return;
    setSearching(roomType);
    joinRoom(roomType);
  };

  const options: { type: RoomType; title: string; players: string; emoji: string }[] = [
    { type: "two_player", title: "2-Player Room", players: "2 players", emoji: "👥" },
    { type: "three_player", title: "3-Player Room", players: "3 players", emoji: "👨‍👩‍👦" },
  ];

  return (
    <div className="space-y-8 py-6">
      <div className="space-y-1 text-center">
        <h1 className="text-3xl font-bold">Choose a room</h1>
        <p className="text-zinc-400">A round starts the moment the room is full.</p>
        {!connected && (
          <p className="flex items-center justify-center gap-2 text-sm text-amber-400/80">
            <Spinner /> Connecting to the game server…
          </p>
        )}
      </div>

      {searching ? (
        <Card className="mx-auto max-w-md space-y-3 text-center">
          <Spinner className="h-6 w-6" />
          <p className="font-semibold">Finding a match…</p>
          <p className="text-sm text-zinc-400">
            Waiting for the {searching === "three_player" ? "3-player" : "2-player"} room to fill.
          </p>
        </Card>
      ) : (
        <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
          {options.map((o) => (
            <button
              key={o.type}
              onClick={() => pick(o.type)}
              disabled={!connected}
              className="glass group flex flex-col items-center gap-3 rounded-2xl border border-white/10 p-8 text-center transition hover:border-indigo-400/50 hover:shadow-glow-brand disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-5xl">{o.emoji}</span>
              <span className="text-lg font-bold">{o.title}</span>
              <span className="text-sm text-zinc-400">{o.players} · one tap each</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-center text-sm text-rose-400">{error}</p>}
    </div>
  );
}

export default function LobbyPage() {
  return (
    <ProtectedRoute>
      <LobbyInner />
    </ProtectedRoute>
  );
}
