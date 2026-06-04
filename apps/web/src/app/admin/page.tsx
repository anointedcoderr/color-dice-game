"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { Badge, Button, Card, HashChip, Input, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { COLOR_HEX, COLOR_TEXT_ON, colorLabel } from "@/lib/colors";
import type { ColorName, RoomType } from "@/lib/types";

type Tab = "users" | "rooms" | "rounds";

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  roundsPlayed: number;
}
interface AdminRoom {
  id: string;
  roomType: RoomType;
  maxPlayers: number;
  status: string;
  membersInRoom: number;
  currentRoundNumber: number | null;
  totalRounds: number;
  createdAt: string;
}
interface AdminRoundPlayer {
  userId: string;
  username: string;
  playerPosition: number;
  hasTapped: boolean;
  resultColor: ColorName | null;
  finalHash: string | null;
  tapTime: string | null;
}
interface AdminRound {
  roundId: string;
  roundNumber: number;
  roomId: string;
  roomType: RoomType;
  status: string;
  nonce: number;
  serverSeedHash: string;
  serverSeed: string | null;
  createdAt: string;
  completedAt: string | null;
  fairnessVerified: boolean;
  players: AdminRoundPlayer[];
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("rounds");

  return (
    <div className="space-y-6 py-6">
      <h1 className="text-3xl font-bold">Admin dashboard</h1>
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {(["rounds", "rooms", "users"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize transition",
              tab === t ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-100",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "rooms" && <RoomsTab />}
      {tab === "rounds" && <RoundsTab />}
    </div>
  );
}

// ── Users ─────────────────────────────────────────────────────────────────────
function UsersTab() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await api.get<{ users: AdminUser[] }>(
        `/api/admin/users?q=${encodeURIComponent(query)}`,
      );
      setUsers(res.users);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grow">
          <Input
            label="Search username / email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="player_kojo"
          />
        </div>
        <Button onClick={() => load(q)}>Search</Button>
      </div>
      {loading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-zinc-500">
              <tr>
                <th className="py-2">Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th className="text-right">Rounds</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="py-2 font-medium">{u.username}</td>
                  <td className="text-zinc-400">{u.email}</td>
                  <td>
                    <Badge className={u.role === "admin" ? "text-fuchsia-300" : ""}>{u.role}</Badge>
                  </td>
                  <td className="text-zinc-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="text-right tabular-nums">{u.roundsPlayed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── Rooms ─────────────────────────────────────────────────────────────────────
function RoomsTab() {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ rooms: AdminRoom[] }>("/api/admin/rooms");
      setRooms(res.rooms);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (roomType: RoomType) => {
    await api.post("/api/admin/rooms", { roomType });
    void load();
  };
  const toggle = async (room: AdminRoom) => {
    const action = room.status === "paused" ? "resume" : "pause";
    await api.post(`/api/admin/rooms/${room.id}/${action}`);
    void load();
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Rooms</h2>
        <div className="flex gap-2">
          <Button variant="subtle" onClick={() => create("two_player")}>
            + New 2P
          </Button>
          <Button variant="subtle" onClick={() => create("three_player")}>
            + New 3P
          </Button>
          <Button variant="ghost" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>
      {loading ? (
        <Spinner />
      ) : rooms.length === 0 ? (
        <p className="text-sm text-zinc-500">No rooms yet.</p>
      ) : (
        <div className="space-y-2">
          {rooms.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{r.roomType === "three_player" ? "3-Player" : "2-Player"}</Badge>
                <Badge
                  className={clsx(
                    r.status === "active" && "text-indigo-300",
                    r.status === "paused" && "text-amber-300",
                    r.status === "completed" && "text-emerald-300",
                  )}
                >
                  {r.status}
                </Badge>
                <span className="text-sm text-zinc-400">
                  {r.membersInRoom}/{r.maxPlayers} in room · {r.totalRounds} rounds
                </span>
                <span className="font-mono text-xs text-zinc-600">{r.id.slice(0, 8)}…</span>
              </div>
              {(r.status === "waiting" || r.status === "paused") && (
                <Button variant={r.status === "paused" ? "primary" : "ghost"} onClick={() => toggle(r)}>
                  {r.status === "paused" ? "Resume" : "Pause"}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Rounds ────────────────────────────────────────────────────────────────────
function RoundsTab() {
  const [filters, setFilters] = useState({ roundId: "", username: "", from: "", to: "" });
  const [rounds, setRounds] = useState<AdminRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const queryString = useCallback(() => {
    const p = new URLSearchParams();
    if (filters.roundId) p.set("roundId", filters.roundId);
    if (filters.username) p.set("username", filters.username);
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    return p.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ rounds: AdminRound[] }>(`/api/admin/rounds?${queryString()}`);
      setRounds(res.rounds);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = async () => {
    const blob = await api.download(`/api/admin/rounds/export.csv?${queryString()}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rounds.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const set = (k: keyof typeof filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <Card className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Input label="Round id / #" value={filters.roundId} onChange={(e) => set("roundId", e.target.value)} />
        <Input label="Username" value={filters.username} onChange={(e) => set("username", e.target.value)} />
        <Input label="From" type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} />
        <Input label="To" type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button onClick={load}>Apply filters</Button>
        <Button variant="ghost" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      {loading ? (
        <Spinner />
      ) : rounds.length === 0 ? (
        <p className="text-sm text-zinc-500">No rounds match.</p>
      ) : (
        <div className="space-y-2">
          {rounds.map((round) => (
            <div key={round.roundId} className="rounded-xl border border-white/10 bg-black/20">
              <button
                onClick={() => setOpen(open === round.roundId ? null : round.roundId)}
                className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">#{round.roundNumber}</span>
                  <Badge>{round.roomType === "three_player" ? "3P" : "2P"}</Badge>
                  <Badge
                    className={round.status === "completed" ? "text-emerald-300" : "text-indigo-300"}
                  >
                    {round.status}
                  </Badge>
                  <span className="text-xs text-zinc-500">
                    {round.completedAt ? new Date(round.completedAt).toLocaleString() : "—"}
                  </span>
                </div>
                <span className="text-xs text-zinc-500">{open === round.roundId ? "▲" : "▼"}</span>
              </button>

              {open === round.roundId && (
                <div className="space-y-3 border-t border-white/10 p-3">
                  <div className="flex flex-col gap-1.5">
                    <HashChip label="seed hash" value={round.serverSeedHash} />
                    <HashChip label="server seed" value={round.serverSeed ?? "(hidden until completed)"} />
                    <HashChip label="nonce" value={String(round.nonce)} />
                    <span className="text-xs text-emerald-400">
                      Fairness: {round.fairnessVerified ? "verified ✓" : "pending"}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="uppercase text-zinc-500">
                        <tr>
                          <th className="py-1">Pos</th>
                          <th>Player</th>
                          <th>Colour</th>
                          <th>Tap time</th>
                          <th>Final hash</th>
                        </tr>
                      </thead>
                      <tbody>
                        {round.players.map((p) => (
                          <tr key={p.userId} className="border-t border-white/5">
                            <td className="py-1.5">{p.playerPosition}</td>
                            <td>{p.username}</td>
                            <td>
                              {p.resultColor ? (
                                <span
                                  className="rounded px-2 py-0.5 font-bold"
                                  style={{
                                    backgroundColor: COLOR_HEX[p.resultColor],
                                    color: COLOR_TEXT_ON[p.resultColor],
                                  }}
                                >
                                  {colorLabel(p.resultColor)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="text-zinc-500">
                              {p.tapTime ? new Date(p.tapTime).toLocaleTimeString() : "—"}
                            </td>
                            <td className="max-w-[180px] truncate font-mono text-zinc-500">
                              {p.finalHash ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
