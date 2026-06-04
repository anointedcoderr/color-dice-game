export type GameErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROUND_NOT_ACTIVE"
  | "NOT_IN_ROUND"
  | "ALREADY_TAPPED"
  | "ROOM_PAUSED"
  | "ROOM_FULL"
  | "UNAUTHORIZED"
  | "INTERNAL";

/** A domain error carrying a stable code that maps to a `round_error` payload. */
export class GameError extends Error {
  code: GameErrorCode;
  constructor(code: GameErrorCode, message?: string) {
    super(message ?? code);
    this.name = "GameError";
    this.code = code;
  }
}

/** A REST error carrying an HTTP status. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
