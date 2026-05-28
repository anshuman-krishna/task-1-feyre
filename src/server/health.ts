import { prisma } from "@/server/prisma";
import { providerCircuitSnapshot, listProviders } from "@/services/prediction/providers";
import { queueDepth } from "@/services/queue/prediction";
import { metrics } from "./metrics";

export type DeepHealth = {
  status: "ok" | "degraded" | "down";
  checks: {
    db: { ok: boolean; latencyMs?: number; error?: string };
    queue: { ok: boolean; depth: Record<string, number>; error?: string };
    providers: { ok: boolean; circuits: Record<string, unknown>; available: { name: string; model: string | null }[] };
    cache: { ok: boolean };
  };
  metrics: ReturnType<typeof metrics.snapshot>;
};

export async function deepHealth(): Promise<DeepHealth> {
  const dbStart = Date.now();
  let db: DeepHealth["checks"]["db"];
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (err) {
    db = { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }

  let queue: DeepHealth["checks"]["queue"];
  try {
    const grouped = await queueDepth();
    const depth: Record<string, number> = {};
    for (const g of grouped) depth[g.status] = g._count._all;
    queue = { ok: true, depth };
  } catch (err) {
    queue = { ok: false, depth: {}, error: err instanceof Error ? err.message : "unknown" };
  }

  const circuits = providerCircuitSnapshot();
  const anyOpen = Object.values(circuits).some(
    (c) => (c as { state: string }).state === "open",
  );

  const overall: DeepHealth["status"] = !db.ok || !queue.ok ? "down" : anyOpen ? "degraded" : "ok";

  return {
    status: overall,
    checks: {
      db,
      queue,
      providers: {
        ok: !anyOpen,
        circuits,
        available: listProviders(),
      },
      cache: { ok: true },
    },
    metrics: metrics.snapshot(),
  };
}
