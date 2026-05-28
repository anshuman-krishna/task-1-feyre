import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// boot the in-process worker on first server-side import. seeded scripts and
// edge runtimes are skipped because they don't have `setInterval` semantics
// we want, and the worker is dev/single-instance only.
const isBuild = process.env.NEXT_PHASE === "phase-production-build";
if (
  typeof window === "undefined" &&
  process.env.NEXT_RUNTIME !== "edge" &&
  !process.env.MIRA_DISABLE_WORKER &&
  !isBuild
) {
  // dynamic import keeps the dependency graph clean (worker depends on
  // services that depend on prisma)
  import("./worker").then((m) => m.ensureWorker()).catch(() => {
    /* startup race during build — safe to ignore */
  });
}
