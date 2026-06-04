import { PrismaClient } from "@prisma/client";

// Singleton PrismaClient (avoids exhausting the Supabase connection pool during
// dev hot-reloads where the module may be re-evaluated).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
