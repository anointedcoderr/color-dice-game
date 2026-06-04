import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/errors";

/** 404 fallback for unmatched routes. */
export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

/** Central error handler. Express identifies it by its 4-arg signature. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Prisma unique-constraint violation
  if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
    res.status(409).json({ error: "A record with that value already exists" });
    return;
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
}
