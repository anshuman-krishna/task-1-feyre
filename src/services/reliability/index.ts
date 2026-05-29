import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { events } from "@/server/events";
import { log } from "@/server/logger";
import { metrics } from "@/server/metrics";
import { enqueuePrediction } from "@/services/queue/prediction";
import { recordFailure as predictionCircuitFail } from "@/services/prediction/providers";
import { createNotification } from "@/services/notification";
import { logAudit, type Actor } from "@/services/audit";

// reliability tooling. admin-only diagnostics that exercise the system
// without touching production-shaped data. each simulation writes an
// audit row + metrics so the effect is observable.

export type Simulation =
  | "queue_burst"
  | "provider_failure"
  | "notification_storm";

export async function runSimulation(
  kind: Simulation,
  opts: { organizationId: string; actor: Actor; intensity?: number } = {
    organizationId: "",
    actor: null,
  },
) {
  const intensity = clamp(opts.intensity ?? 5, 1, 25);
  log.warn("reliability.simulation.start", { kind, intensity });

  let result: Record<string, unknown> = {};
  switch (kind) {
    case "queue_burst":
      result = await queueBurst(opts.organizationId, intensity);
      break;
    case "provider_failure":
      result = await providerFailure(opts.organizationId, intensity);
      break;
    case "notification_storm":
      result = await notificationStorm(opts.organizationId, opts.actor, intensity);
      break;
  }

  await logAudit({
    action: "simulation_run",
    entityType: "simulation",
    entityId: kind,
    actor: opts.actor,
    metadata: { kind, intensity, result } as unknown as Prisma.InputJsonValue,
  });
  metrics.inc("simulations_run", { kind });
  log.warn("reliability.simulation.end", { kind, intensity, result });

  return { kind, intensity, result };
}

async function queueBurst(organizationId: string, intensity: number) {
  // pick random active patients with biomarkers and enqueue duplicate jobs
  const candidates = await prisma.patient.findMany({
    where: { organizationId, archivedAt: null, glucose: { not: null } },
    take: intensity,
    orderBy: { createdAt: "desc" },
  });
  for (const p of candidates) {
    await enqueuePrediction(p.id);
  }
  return { enqueued: candidates.length };
}

async function providerFailure(_organizationId: string, intensity: number) {
  // trip the openai breaker to prove fallback. internal stays the floor.
  for (let i = 0; i < intensity; i++) {
    predictionCircuitFail("openai");
  }
  return { provider: "openai", openedBy: intensity };
}

async function notificationStorm(
  organizationId: string,
  actor: Actor,
  intensity: number,
) {
  // synthesise low-priority system notifications for the acting admin.
  // groupKey is shared so dedupe under load is exercised too.
  if (!actor?.id) return { sent: 0, note: "no actor" };
  for (let i = 0; i < intensity; i++) {
    events.emit("activity.recorded", { action: "view", patientId: null });
    await createNotification({
      userId: actor.id,
      organizationId,
      type: "system",
      priority: "low",
      title: `simulation event ${i + 1}`,
      body: "synthetic load test event — safe to ignore",
      groupKey: "simulation:notification_storm",
      dedupeMinutes: 5,
    });
  }
  return { sent: intensity };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
