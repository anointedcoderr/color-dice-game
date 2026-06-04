// Canonical colour list. The result index is (number % 6) into THIS array.
// Order and spelling MUST stay byte-identical to:
//   - the Prisma `Colour` enum (apps/server/prisma/schema.prisma)
//   - the frontend copy (apps/web/src/lib/colors.ts)
// Do not reorder.
export const COLORS = ["red", "black", "blue", "green", "yellow", "white"] as const;

export type ColorName = (typeof COLORS)[number];

export type RoomType = "two_player" | "three_player";
export type RoomStatus = "waiting" | "active" | "completed" | "paused";
export type RoundStatus = "active" | "completed";
export type Role = "user" | "admin";

export const maxPlayersFor = (roomType: RoomType): number =>
  roomType === "three_player" ? 3 : 2;
