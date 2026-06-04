import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "../types/socket";

export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let ioRef: TypedServer | null = null;

export function setIo(io: TypedServer): void {
  ioRef = io;
}

export function getIo(): TypedServer {
  if (!ioRef) throw new Error("Socket.io server not initialised");
  return ioRef;
}
