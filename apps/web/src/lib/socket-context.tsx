"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "./auth-context";
import type { ColorName, CompletedPlayer, PlayerSlot, RoomState, RoomType } from "./types";

const SOCKET_URL = (process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000").replace(
  /\/+$/,
  "",
);

const initialRoomState: RoomState = {
  roomId: null,
  roomType: null,
  maxPlayers: 2,
  status: "waiting",
  roundId: null,
  roundNumber: null,
  serverSeedHash: null,
  serverSeed: null,
  nonce: null,
  players: [],
  myUserId: null,
  iHaveTapped: false,
  myResult: null,
  error: null,
  completedSummary: null,
};

type Action =
  | { type: "SET_ME"; userId: string }
  | { type: "RESET" }
  | {
      type: "PLAYER_JOINED";
      roomId: string;
      roomType: RoomType;
      maxPlayers: number;
      players: PlayerSlot[];
      status: RoomState["status"];
    }
  | {
      type: "ROUND_STARTED";
      roomId: string;
      roundId: string;
      roundNumber: number;
      serverSeedHash: string;
      nonce: number;
      players: PlayerSlot[];
    }
  | { type: "PLAYER_TAPPED"; userId: string; tapTime: string }
  | { type: "COLOR_REVEALED"; userId: string; resultColor: ColorName }
  | { type: "ROUND_COMPLETED"; players: CompletedPlayer[]; serverSeed: string }
  | { type: "ERROR"; message: string }
  | { type: "CLEAR_ERROR" };

function roomReducer(state: RoomState, action: Action): RoomState {
  switch (action.type) {
    case "SET_ME":
      return { ...state, myUserId: action.userId };
    case "RESET":
      return { ...initialRoomState, myUserId: state.myUserId };
    case "PLAYER_JOINED":
      return {
        ...state,
        roomId: action.roomId,
        roomType: action.roomType,
        maxPlayers: action.maxPlayers,
        players: action.players,
        status: action.status,
        error: null,
      };
    case "ROUND_STARTED":
      return {
        ...state,
        roomId: action.roomId,
        status: "active",
        roundId: action.roundId,
        roundNumber: action.roundNumber,
        serverSeedHash: action.serverSeedHash,
        serverSeed: null,
        nonce: action.nonce,
        players: action.players.map((p) => ({ ...p, hasTapped: false, resultColor: null })),
        iHaveTapped: false,
        myResult: null,
        completedSummary: null,
        error: null,
      };
    case "PLAYER_TAPPED":
      return {
        ...state,
        players: state.players.map((p) =>
          p.userId === action.userId ? { ...p, hasTapped: true, tapTime: action.tapTime } : p,
        ),
        iHaveTapped: action.userId === state.myUserId ? true : state.iHaveTapped,
      };
    case "COLOR_REVEALED":
      return {
        ...state,
        players: state.players.map((p) =>
          p.userId === action.userId ? { ...p, resultColor: action.resultColor } : p,
        ),
        myResult: action.userId === state.myUserId ? action.resultColor : state.myResult,
      };
    case "ROUND_COMPLETED":
      return {
        ...state,
        status: "completed",
        serverSeed: action.serverSeed,
        completedSummary: action.players,
        players: state.players.map((p) => {
          const summary = action.players.find((s) => s.userId === p.userId);
          return summary
            ? { ...p, hasTapped: true, resultColor: summary.resultColor, tapTime: summary.tapTime }
            : p;
        }),
      };
    case "ERROR":
      return { ...state, error: action.message };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

interface SocketContextValue {
  connected: boolean;
  room: RoomState;
  joinRoom: (roomType: RoomType) => void;
  tap: () => void;
  reset: () => void;
  clearError: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [room, dispatch] = useReducer(roomReducer, initialRoomState);

  useEffect(() => {
    if (user) dispatch({ type: "SET_ME", userId: user.id });
  }, [user]);

  useEffect(() => {
    if (!token || !user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err: Error) =>
      dispatch({ type: "ERROR", message: err.message || "Connection error" }),
    );

    socket.on("player_joined", (p) => dispatch({ type: "PLAYER_JOINED", ...p }));
    socket.on("round_started", (p) => dispatch({ type: "ROUND_STARTED", ...p }));
    socket.on("player_tapped", (p) =>
      dispatch({ type: "PLAYER_TAPPED", userId: p.userId, tapTime: p.tapTime }),
    );
    socket.on("color_revealed", (p) =>
      dispatch({ type: "COLOR_REVEALED", userId: p.userId, resultColor: p.resultColor }),
    );
    socket.on("round_completed", (p) =>
      dispatch({ type: "ROUND_COMPLETED", players: p.players, serverSeed: p.serverSeed }),
    );
    socket.on("round_error", (p) => dispatch({ type: "ERROR", message: p.message }));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, user]);

  const joinRoom = useCallback((roomType: RoomType) => {
    dispatch({ type: "RESET" });
    socketRef.current?.emit("join_room", { roomType });
  }, []);

  const tap = useCallback(() => {
    if (room.iHaveTapped || room.status !== "active" || !room.roomId || !room.roundId) return;
    socketRef.current?.emit("tap", { roomId: room.roomId, roundId: room.roundId });
  }, [room.iHaveTapped, room.status, room.roomId, room.roundId]);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);
  const clearError = useCallback(() => dispatch({ type: "CLEAR_ERROR" }), []);

  return (
    <SocketContext.Provider value={{ connected, room, joinRoom, tap, reset, clearError }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within a SocketProvider");
  return ctx;
}
