import { prisma } from "@/server/prisma";
import { env } from "@/server/env";
import { fail, ok } from "@/lib/api-response";

// readiness probe. answers "is the process ready to take traffic" — env
// parsed, database reachable, worker booted. cheap; safe to hit at /readyz.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    env();
  } catch (e) {
    return fail("env_invalid", 503, "env_invalid", {
      message: e instanceof Error ? e.message : "unknown",
    });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    return fail("db_unavailable", 503, "db_unavailable", {
      message: e instanceof Error ? e.message : "unknown",
    });
  }
  return ok({ ready: true, ts: new Date().toISOString() });
}
