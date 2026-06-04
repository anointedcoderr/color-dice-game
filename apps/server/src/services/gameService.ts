import { prisma } from "../lib/prisma";
import { computeResult, generateServerSeed, hashServerSeed } from "../lib/fairness";
import { GameError } from "../lib/errors";
import { env } from "../config/env";
import { getIo } from "../socket/io";
import { maxPlayersFor, type RoomType, type ColorName } from "../shared/colors";
import * as registry from "./roomRegistry";
import type { LiveRoom, LiveMember } from "./roomRegistry";
import type { PlayerSlot } from "../types/socket";

interface SessionUser {
  id: string;
  username: string;
}

function nextFreePosition(room: LiveRoom): number {
  const taken = new Set([...room.members.values()].map((m) => m.playerPosition));
  for (let p = 1; p <= room.maxPlayers; p++) {
    if (!taken.has(p)) return p;
  }
  return room.members.size + 1;
}

function playerSlots(room: LiveRoom): PlayerSlot[] {
  return [...room.members.values()]
    .sort((a, b) => a.playerPosition - b.playerPosition)
    .map((m) => ({
      userId: m.userId,
      username: m.username,
      playerPosition: m.playerPosition,
      connected: m.connected,
      hasTapped: room.tapped.has(m.userId),
      resultColor: null,
      tapTime: null,
    }));
}

// ── Matchmaking ───────────────────────────────────────────────────────────────
// Find-or-create a waiting room of the requested type and seat the user.
// Idempotent: a user already seated in a non-completed room of that type is
// returned as-is (handles re-emits / reconnect without duplicating a seat).
export async function joinRoom(
  user: SessionUser,
  roomType: RoomType,
  socketId: string,
): Promise<{ room: LiveRoom; justFilled: boolean }> {
  const maxPlayers = maxPlayersFor(roomType);

  for (const room of registry.all()) {
    if (room.roomType === roomType && room.status !== "completed" && room.members.has(user.id)) {
      const member = room.members.get(user.id)!;
      member.connected = true;
      member.socketId = socketId;
      return { room, justFilled: false };
    }
  }

  let room = registry.findWaiting(roomType, maxPlayers);
  if (!room) {
    const dbRoom = await prisma.gameRoom.create({
      data: { roomType, maxPlayers, status: "waiting" },
    });
    room = registry.create(dbRoom.id, roomType, maxPlayers);
  }

  const position = nextFreePosition(room);
  const member: LiveMember = {
    userId: user.id,
    username: user.username,
    playerPosition: position,
    connected: true,
    socketId,
  };
  room.members.set(user.id, member);

  const justFilled = room.members.size >= room.maxPlayers && room.status === "waiting";
  return { room, justFilled };
}

export function broadcastPlayerJoined(room: LiveRoom): void {
  getIo().to(room.id).emit("player_joined", {
    roomId: room.id,
    roomType: room.roomType,
    maxPlayers: room.maxPlayers,
    players: playerSlots(room),
    status: room.status === "active" || room.status === "completed" ? "waiting" : room.status,
  });
}

// ── Round start ─────────────────────────────────────────────────────────────
export async function startRound(room: LiveRoom): Promise<void> {
  if (room.status !== "waiting") return;

  const serverSeed = generateServerSeed();
  const serverSeedHash = hashServerSeed(serverSeed);
  const roundNumber = room.roundNumber + 1;
  const nonce = roundNumber;

  const round = await prisma.$transaction(async (tx) => {
    const created = await tx.round.create({
      data: { roomId: room.id, roundNumber, status: "active", serverSeedHash, serverSeed, nonce },
    });
    await tx.gameRoom.update({ where: { id: room.id }, data: { status: "active" } });
    await tx.roundPlayer.createMany({
      data: [...room.members.values()].map((m) => ({
        roundId: created.id,
        userId: m.userId,
        playerPosition: m.playerPosition,
        hasTapped: false,
      })),
    });
    return created;
  });

  room.status = "active";
  room.roundNumber = roundNumber;
  room.currentRoundId = round.id;
  room.serverSeed = serverSeed;
  room.serverSeedHash = serverSeedHash;
  room.nonce = nonce;
  room.tapped = new Set();
  registry.unmarkWaiting(room);

  // Emit the commitment (hash only) — no seed, no colours.
  getIo().to(room.id).emit("round_started", {
    roomId: room.id,
    roundId: round.id,
    roundNumber,
    serverSeedHash,
    nonce,
    players: playerSlots(room),
  });

  if (env.ROUND_TAP_TIMEOUT_MS > 0) {
    room.tapTimer = setTimeout(() => {
      void autoResolveRound(room.id).catch((e) => console.error("autoResolve failed:", e));
    }, env.ROUND_TAP_TIMEOUT_MS);
  }
}

// ── Tap handling (serialised per room via tapLock) ────────────────────────────
export function handleTap(
  userId: string,
  roomId: string,
  roundId: string,
): Promise<{ resultColor: ColorName; finalHash: string; completed: boolean }> {
  const room = registry.get(roomId);
  if (!room) return Promise.reject(new GameError("ROOM_NOT_FOUND"));

  const result = room.tapLock.then(() => doTap(room, userId, roundId));
  room.tapLock = result.catch(() => {}); // keep the chain alive regardless of outcome
  return result;
}

async function persistTap(
  room: LiveRoom,
  member: LiveMember,
): Promise<{ resultColor: ColorName; finalHash: string; tapTime: Date }> {
  const { finalHash, resultColor } = computeResult({
    serverSeed: room.serverSeed!,
    roundId: room.currentRoundId!,
    userId: member.userId,
    playerPosition: member.playerPosition,
    nonce: room.nonce!,
  });
  const tapTime = new Date();

  await prisma.$transaction(async (tx) => {
    // Guarded update: only succeeds while hasTapped is still false → wins the
    // double-tap race; count === 0 means a concurrent tap already landed.
    const updated = await tx.roundPlayer.updateMany({
      where: { roundId: room.currentRoundId!, userId: member.userId, hasTapped: false },
      data: { hasTapped: true, tapTime, resultColor, finalHash },
    });
    if (updated.count === 0) throw new GameError("ALREADY_TAPPED");

    await tx.fairnessLog.create({
      data: {
        roundId: room.currentRoundId!,
        userId: member.userId,
        serverSeed: room.serverSeed!,
        serverSeedHash: room.serverSeedHash!,
        nonce: room.nonce!,
        playerPosition: member.playerPosition,
        finalHash,
        resultColor,
      },
    });
  });

  room.tapped.add(member.userId);
  return { resultColor, finalHash, tapTime };
}

async function doTap(
  room: LiveRoom,
  userId: string,
  roundId: string,
): Promise<{ resultColor: ColorName; finalHash: string; completed: boolean }> {
  if (room.status !== "active" || !room.currentRoundId) throw new GameError("ROUND_NOT_ACTIVE");
  if (roundId && roundId !== room.currentRoundId) throw new GameError("ROUND_NOT_ACTIVE");

  const member = room.members.get(userId);
  if (!member) throw new GameError("NOT_IN_ROUND");
  if (room.tapped.has(userId)) throw new GameError("ALREADY_TAPPED");

  const { resultColor, finalHash, tapTime } = await persistTap(room, member);

  const io = getIo();
  io.to(room.id).emit("player_tapped", {
    roomId: room.id,
    roundId: room.currentRoundId!,
    userId,
    playerPosition: member.playerPosition,
    tapTime: tapTime.toISOString(),
  });
  io.to(room.id).emit("color_revealed", {
    roomId: room.id,
    roundId: room.currentRoundId!,
    userId,
    playerPosition: member.playerPosition,
    resultColor,
  });

  const completed = room.tapped.size >= room.maxPlayers;
  if (completed) {
    await completeRound(room);
  }
  return { resultColor, finalHash, completed };
}

// ── Completion ────────────────────────────────────────────────────────────────
async function completeRound(room: LiveRoom): Promise<void> {
  if (room.tapTimer) {
    clearTimeout(room.tapTimer);
    room.tapTimer = undefined;
  }
  const roundId = room.currentRoundId!;

  const summary = await prisma.$transaction(async (tx) => {
    const players = await tx.roundPlayer.findMany({
      where: { roundId },
      include: { user: { select: { username: true } } },
      orderBy: { playerPosition: "asc" },
    });
    if (players.some((p) => !p.hasTapped)) return null; // not actually done
    const round = await tx.round.update({
      where: { id: roundId },
      data: { status: "completed", completedAt: new Date() },
    });
    await tx.gameRoom.update({ where: { id: room.id }, data: { status: "completed" } });
    return { round, players };
  });
  if (!summary) return;

  room.status = "completed";
  getIo().to(room.id).emit("round_completed", {
    roomId: room.id,
    roundId,
    roundNumber: summary.round.roundNumber,
    players: summary.players.map((p) => ({
      userId: p.userId ?? p.id,
      username: p.user?.username ?? p.playerName ?? `Player ${p.playerPosition}`,
      playerPosition: p.playerPosition,
      resultColor: p.resultColor,
      finalHash: p.finalHash,
      tapTime: p.tapTime ? p.tapTime.toISOString() : null,
    })),
    serverSeedHash: room.serverSeedHash!,
    serverSeed: room.serverSeed!, // revealed only now
    nonce: room.nonce!,
  });

  // Secret is now public via DB too; drop the live room.
  registry.remove(room.id);
}

// ── Optional: auto-resolve untapped seats on timeout (provably fair) ──────────
async function autoResolveRound(roomId: string): Promise<void> {
  const room = registry.get(roomId);
  if (!room) return;
  const result = room.tapLock.then(async () => {
    if (room.status !== "active" || !room.currentRoundId) return;
    const io = getIo();
    for (const member of room.members.values()) {
      if (room.tapped.has(member.userId)) continue;
      const { resultColor, tapTime } = await persistTap(room, member);
      io.to(room.id).emit("player_tapped", {
        roomId: room.id,
        roundId: room.currentRoundId!,
        userId: member.userId,
        playerPosition: member.playerPosition,
        tapTime: tapTime.toISOString(),
      });
      io.to(room.id).emit("color_revealed", {
        roomId: room.id,
        roundId: room.currentRoundId!,
        userId: member.userId,
        playerPosition: member.playerPosition,
        resultColor,
      });
    }
    await completeRound(room);
  });
  room.tapLock = result.catch(() => {});
  await result;
}

// ── Disconnect handling ───────────────────────────────────────────────────────
export function handleDisconnect(userId: string, socketId: string): void {
  for (const room of registry.all()) {
    const member = room.members.get(userId);
    if (!member || member.socketId !== socketId) continue;

    if (room.status === "waiting") {
      room.members.delete(userId);
      if (room.members.size === 0) {
        registry.remove(room.id);
      } else {
        broadcastPlayerJoined(room);
      }
    } else {
      // Keep membership during an active round so a reconnect can still tap.
      member.connected = false;
    }
  }
}

export { playerSlots };
