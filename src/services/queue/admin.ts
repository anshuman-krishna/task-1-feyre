import type { PredictionJobStatus } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { events } from "@/server/events";
import { logAudit, type Actor } from "@/services/audit";
import { metrics } from "@/server/metrics";

// queue administration. listing + retry surfaces for the admin area.
// retrying a dead-letter resets attempts and reschedules — the worker
// picks it up on the next tick.

export type QueueFilter = {
  status?: PredictionJobStatus;
  limit?: number;
};

export async function listJobs(filter: QueueFilter = {}) {
  return prisma.predictionJob.findMany({
    where: { status: filter.status },
    orderBy: { createdAt: "desc" },
    take: filter.limit ?? 40,
    include: { patient: { select: { id: true, fullName: true, organizationId: true } } },
  });
}

export async function jobCountsByStatus() {
  const grouped = await prisma.predictionJob.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const map: Record<PredictionJobStatus, number> = {
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    dead: 0,
  };
  for (const g of grouped) map[g.status] = g._count._all;
  return map;
}

export async function retryJob(jobId: string, actor?: Actor) {
  const job = await prisma.predictionJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("job not found");
  if (job.status !== "dead" && job.status !== "failed") {
    throw new Error(`cannot retry job in status ${job.status}`);
  }

  const next = await prisma.predictionJob.update({
    where: { id: jobId },
    data: {
      status: "queued",
      attempts: 0,
      scheduledFor: new Date(),
      error: null,
      startedAt: null,
      completedAt: null,
    },
  });

  await logAudit({
    action: "manual_retry",
    entityType: "prediction_job",
    entityId: jobId,
    patientId: job.patientId,
    actor,
    metadata: { from: job.status, attempts: job.attempts },
  });

  metrics.inc("queue_manual_retries");
  events.emit("prediction.queued", { jobId: next.id, patientId: next.patientId });
  return next;
}

export async function purgeCompleted(olderThanDays = 30) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await prisma.predictionJob.deleteMany({
    where: { status: "completed", completedAt: { lt: cutoff } },
  });
  metrics.inc("queue_purged", {}, result.count);
  return result;
}
