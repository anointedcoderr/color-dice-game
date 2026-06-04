import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { Role } from "../shared/colors";

export interface JwtPayload {
  sub: string; // user id
  username: string;
  role: Role;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }
  return {
    sub: String(decoded.sub),
    username: String((decoded as Record<string, unknown>).username ?? ""),
    role: (decoded as Record<string, unknown>).role === "admin" ? "admin" : "user",
  };
}
