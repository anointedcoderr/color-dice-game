"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button, Card, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS, COLOR_HEX } from "@/lib/colors";
import { colorLabel } from "@/lib/colors";
import type { ColorName } from "@/lib/types";

interface Stats {
  user: { id: string; username: string; email: string; role: string; createdAt: string };
  totalRounds: number;
  distribution: Record<string, number>;
}

function ProfileInner() {
  const { logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Stats>("/api/users/me/stats")
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load profile"));
  }, []);

  if (error) return <p className="py-10 text-rose-400">{error}</p>;
  if (!stats)
    return (
      <div className="flex items-center gap-2 py-10 text-zinc-400">
        <Spinner /> Loading…
      </div>
    );

  const max = Math.max(1, ...COLORS.map((c) => stats.distribution[c] ?? 0));

  return (
    <div className="space-y-6 py-6">
      <h1 className="text-3xl font-bold">Profile</h1>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-bold">{stats.user.username}</p>
            <p className="text-sm text-zinc-400">{stats.user.email}</p>
          </div>
          <span className="rounded-full bg-white/5 px-3 py-1 text-xs capitalize text-zinc-300">
            {stats.user.role}
          </span>
        </div>
        <p className="text-sm text-zinc-500">
          Member since {new Date(stats.user.createdAt).toLocaleDateString()} · {stats.totalRounds}{" "}
          {stats.totalRounds === 1 ? "round" : "rounds"} played
        </p>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Colour distribution</h2>
        <div className="space-y-2.5">
          {COLORS.map((c: ColorName) => {
            const count = stats.distribution[c] ?? 0;
            return (
              <div key={c} className="flex items-center gap-3">
                <span className="w-16 text-sm text-zinc-400">{colorLabel(c)}</span>
                <div className="h-3 grow overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(count / max) * 100}%`,
                      backgroundColor: COLOR_HEX[c],
                      boxShadow: `0 0 10px ${COLOR_HEX[c]}99`,
                    }}
                  />
                </div>
                <span className="w-8 text-right text-sm tabular-nums text-zinc-300">{count}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Button variant="danger" onClick={logout}>
        Log out
      </Button>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileInner />
    </ProtectedRoute>
  );
}
