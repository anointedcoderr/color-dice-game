import type { Socket } from "socket.io";
import { verifyToken } from "../lib/jwt";
import { GameError } from "../lib/errors";
import type { TypedServer } from "./io";
import { setIo } from "./io";
import * as gameService from "../services/gameService";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "../types/socket";

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

function emitError(socket: TypedSocket, code: GameError["code"], message: string, roomId?: string) {
  socket.emit("round_error", { code, message, roomId });
}

export function registerSocket(io: TypedServer): void {
  setIo(io);

  // Handshake JWT auth — runs before any event is handled.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = verifyToken(token);
      socket.data.user = {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
      };
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket: TypedSocket) => {
    const user = socket.data.user;

    socket.on("join_room", async ({ roomType }) => {
      try {
        if (roomType !== "two_player" && roomType !== "three_player") {
          throw new GameError("INTERNAL", "Invalid room type");
        }
        const { room, justFilled } = await gameService.joinRoom(user, roomType, socket.id);
        await socket.join(room.id);
        gameService.broadcastPlayerJoined(room);
        if (justFilled) {
          await gameService.startRound(room);
        }
      } catch (err) {
        if (err instanceof GameError) emitError(socket, err.code, err.message);
        else {
          console.error("join_room error:", err);
          emitError(socket, "INTERNAL", "Could not join room");
        }
      }
    });

    socket.on("tap", async ({ roomId, roundId }) => {
      try {
        await gameService.handleTap(user.id, roomId, roundId);
      } catch (err) {
        if (err instanceof GameError) emitError(socket, err.code, err.message, roomId);
        else {
          console.error("tap error:", err);
          emitError(socket, "INTERNAL", "Tap failed", roomId);
        }
      }
    });

    socket.on("leave_room", ({ roomId }) => {
      void socket.leave(roomId);
    });

    socket.on("disconnect", () => {
      gameService.handleDisconnect(user.id, socket.id);
    });
  });
}
