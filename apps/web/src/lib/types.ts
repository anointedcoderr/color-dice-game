export type ColorName = "red" | "black" | "blue" | "green" | "yellow" | "white";
export type RoomType = "two_player" | "three_player";
export type Role = "user" | "admin";
export type RoomStatus = "waiting" | "active" | "completed" | "paused";

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PlayerSlot {
  userId: string;
  username: string;
  playerPosition: number;
  connected: boolean;
  hasTapped: boolean;
  resultColor: ColorName | null;
  tapTime: string | null;
}

export interface RoomState {
  roomId: string | null;
  roomType: RoomType | null;
  maxPlayers: number;
  status: RoomStatus;
  roundId: string | null;
  roundNumber: number | null;
  serverSeedHash: string | null;
  serverSeed: string | null;
  nonce: number | null;
  players: PlayerSlot[];
  myUserId: string | null;
  iHaveTapped: boolean;
  myResult: ColorName | null;
  error: string | null;
  completedSummary: CompletedPlayer[] | null;
}

export interface CompletedPlayer {
  userId: string;
  username: string;
  playerPosition: number;
  resultColor: ColorName | null;
  finalHash: string | null;
  tapTime: string | null;
}

export interface HistoryRound {
  roundId: string;
  roundNumber: number;
  roomType: RoomType;
  status: string;
  completedAt: string | null;
  myPlayerPosition: number;
  myResultColor: ColorName | null;
  myFinalHash: string | null;
}
