import type { RoomType } from "../shared/colors";

// ── In-memory authoritative state for LIVE rooms ──────────────────────────────
// The DB is the durable record; this registry is the hot state used for realtime
// coordination (positions, tap progress, the secret seed) so we don't hit the DB
// on every socket event. On a server restart this state is lost (single-instance
// MVP) — the Redis/Upstash upgrade path would move this into shared storage.

export interface LiveMember {
  userId: string;
  username: string;
  playerPosition: number;
  connected: boolean;
  socketId?: string;
}

export interface LiveRoom {
  id: string;
  roomType: RoomType;
  maxPlayers: number;
  status: "waiting" | "active" | "completed" | "paused";
  members: Map<string, LiveMember>;
  roundNumber: number;
  currentRoundId?: string;
  serverSeed?: string; // held in memory only while a round runs; never emitted pre-completion
  serverSeedHash?: string;
  nonce?: number;
  tapped: Set<string>;
  tapLock: Promise<unknown>; // serialises tap completion per room
  tapTimer?: ReturnType<typeof setTimeout>;
}

const rooms = new Map<string, LiveRoom>();
const waitingByType: Record<RoomType, Set<string>> = {
  two_player: new Set(),
  three_player: new Set(),
};

export function get(id: string): LiveRoom | undefined {
  return rooms.get(id);
}

export function all(): IterableIterator<LiveRoom> {
  return rooms.values();
}

export function create(id: string, roomType: RoomType, maxPlayers: number): LiveRoom {
  const room: LiveRoom = {
    id,
    roomType,
    maxPlayers,
    status: "waiting",
    members: new Map(),
    roundNumber: 0,
    tapped: new Set(),
    tapLock: Promise.resolve(),
  };
  rooms.set(id, room);
  waitingByType[roomType].add(id);
  return room;
}

export function remove(id: string): void {
  const room = rooms.get(id);
  if (room?.tapTimer) clearTimeout(room.tapTimer);
  rooms.delete(id);
  waitingByType.two_player.delete(id);
  waitingByType.three_player.delete(id);
}

export function findWaiting(roomType: RoomType, maxPlayers: number): LiveRoom | undefined {
  for (const id of waitingByType[roomType]) {
    const room = rooms.get(id);
    if (room && room.status === "waiting" && room.members.size < maxPlayers) {
      return room;
    }
  }
  return undefined;
}

export function unmarkWaiting(room: LiveRoom): void {
  waitingByType[room.roomType].delete(room.id);
}

export function markWaiting(room: LiveRoom): void {
  if (room.status === "waiting") waitingByType[room.roomType].add(room.id);
}

export function pause(room: LiveRoom): void {
  room.status = "paused";
  unmarkWaiting(room);
}

export function resume(room: LiveRoom): void {
  if (room.status === "paused") {
    room.status = "waiting";
    markWaiting(room);
  }
}

export interface LiveRoomSnapshot {
  id: string;
  memberCount: number;
  status: LiveRoom["status"];
  currentRoundNumber: number | null;
}

export function snapshot(): Map<string, LiveRoomSnapshot> {
  const out = new Map<string, LiveRoomSnapshot>();
  for (const room of rooms.values()) {
    out.set(room.id, {
      id: room.id,
      memberCount: room.members.size,
      status: room.status,
      currentRoundNumber: room.status === "active" ? room.roundNumber : null,
    });
  }
  return out;
}
