"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Badge, Card, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { COLOR_HEX, COLOR_GLOW, COLOR_TEXT_ON, colorLabel } from "@/lib/colors";
import type { HistoryRound } from "@/lib/types";

function HistoryInner() {
  const [rounds, setRounds] = useState<HistoryRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ rounds: HistoryRound[] }>("/api/rounds/history?limit=50")
      .then((res) => setRounds(res.rounds))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load history"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold">Round history</h1>
        <p className="text-zinc-400">Every completed round you’ve played.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-400">
          <Spinner /> Loading…
        </div>
      ) : error ? (
        <p className="text-rose-400">{error}</p>
      ) : rounds.length === 0 ? (
        <Card className="text-center text-zinc-400">
          No rounds yet.{" "}
          <Link href="/lobby" className="text-indigo-300 hover:underline">
            Play your first game →
          </Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {rounds.map((r) => (
            <Card key={r.roundId} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="font-bold">#{r.roundNumber}</span>
                <Badge>{r.roomType === "three_player" ? "3-Player" : "2-Player"}</Badge>
                <span className="text-sm text-zinc-500">
                  {r.completedAt ? new Date(r.completedAt).toLocaleString() : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {r.myResultColor ? (
                  <span
                    className="rounded-lg px-3 py-1 text-sm font-bold"
                    style={{
                      backgroundColor: COLOR_HEX[r.myResultColor],
                      color: COLOR_TEXT_ON[r.myResultColor],
                      boxShadow: `0 0 18px 1px ${COLOR_GLOW[r.myResultColor]}`,
                    }}
                  >
                    {colorLabel(r.myResultColor)}
                  </span>
                ) : (
                  <span className="text-sm text-zinc-500">—</span>
                )}
                <Link
                  href={`/verify?roundId=${r.roundId}`}
                  className="text-xs font-medium text-indigo-300 hover:underline"
                >
                  Verify
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <ProtectedRoute>
      <HistoryInner />
    </ProtectedRoute>
  );
}
