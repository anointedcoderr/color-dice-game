import type { ColorName, RoomType, RoomStatus } from "../shared/colors";
import type { GameErrorCode } from "../lib/errors";

export interface PlayerSlot {
  userId: string;
  username: string;
  playerPosition: number;
  connected: boolean;
  hasTapped: boolean;
  resultColor: ColorName | null;
  tapTime: string | null;
}

// ───────── client → server ─────────
export interface ClientToServerEvents {
  join_room: (payload: { roomType: RoomType }) => void;
  leave_room: (payload: { roomId: string }) => void;
  tap: (payload: { roomId: string; roundId: string }) => void;
}

// ───────── server → clients ─────────
export interface ServerToClientEvents {
  player_joined: (payload: {
    roomId: string;
    roomType: RoomType;
    maxPlayers: number;
    players: PlayerSlot[];
    status: RoomStatus;
  }) => void;

  round_started: (payload: {
    roomId: string;
    roundId: string;
    roundNumber: number;
    serverSeedHash: string;
    nonce: number;
    players: PlayerSlot[];
  }) => void;

  player_tapped: (payload: {
    roomId: string;
    roundId: string;
    userId: string;
    playerPosition: number;
    tapTime: string;
  }) => void;

  color_revealed: (payload: {
    roomId: string;
    roundId: string;
    userId: string;
    playerPosition: number;
    resultColor: ColorName;
  }) => void;

  round_completed: (payload: {
    roomId: string;
    roundId: string;
    roundNumber: number;
    players: {
      userId: string;
      username: string;
      playerPosition: number;
      resultColor: ColorName | null;
      finalHash: string | null;
      tapTime: string | null;
    }[];
    serverSeedHash: string;
    serverSeed: string; // revealed here
    nonce: number;
  }) => void;

  round_error: (payload: {
    roomId?: string;
    roundId?: string;
    code: GameErrorCode;
    message: string;
  }) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  user: { id: string; username: string; role: "user" | "admin" };
}
