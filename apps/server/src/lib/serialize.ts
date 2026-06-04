import type { Round, RoundPlayer, GameRoom, User } from "@prisma/client";

// ── The single chokepoint that decides when the secret serverSeed is exposed ──
// Every client/admin/public read of a round goes through here. `serverSeed` is
// included ONLY when the round is completed. No route returns a raw Prisma Round.

type RoundPlayerWithUser = RoundPlayer & { user?: Pick<User, "id" | "username"> | null };
type RoundWithRelations = Round & {
  players?: RoundPlayerWithUser[];
  room?: GameRoom | null;
};

export interface PublicPlayer {
  userId: string;
  username: string | null;
  playerPosition: number;
  hasTapped: boolean;
  tapTime: string | null;
  resultColor: string | null;
  finalHash: string | null;
}

export interface PublicRound {
  roundId: string;
  roomId: string;
  roundNumber: number;
  status: string;
  roomType?: string;
  nonce: number;
  serverSeedHash: string;
  serverSeed: string | null; // revealed only when completed
  createdAt: string;
  completedAt: string | null;
  players?: PublicPlayer[];
}

export function serializePlayer(p: RoundPlayerWithUser): PublicPlayer {
  return {
    userId: p.userId,
    username: p.user?.username ?? null,
    playerPosition: p.playerPosition,
    hasTapped: p.hasTapped,
    tapTime: p.tapTime ? p.tapTime.toISOString() : null,
    resultColor: p.resultColor ?? null,
    finalHash: p.finalHash ?? null,
  };
}

export function serializeRound(round: RoundWithRelations): PublicRound {
  const isCompleted = round.status === "completed";
  return {
    roundId: round.id,
    roomId: round.roomId,
    roundNumber: round.roundNumber,
    status: round.status,
    roomType: round.room?.roomType,
    nonce: round.nonce,
    serverSeedHash: round.serverSeedHash,
    serverSeed: isCompleted ? round.serverSeed : null, // ← the gate
    createdAt: round.createdAt.toISOString(),
    completedAt: round.completedAt ? round.completedAt.toISOString() : null,
    players: round.players?.map(serializePlayer),
  };
}
