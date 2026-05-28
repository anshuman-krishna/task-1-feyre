import type { PredictionJob } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { log } from "@/server/logger";
import { metrics } from "@/server/metrics";
import { events } from "@/server/events";
import { executePrediction } from "@/services/prediction";
import { createNotification } from "@/services/notification";
import { applyAutoTransition } from "@/services/workflow";
import { logAudit, type Actor } from "@/services/audit";

const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 5_000;

export async function enqueuePrediction(
  patientId: string,
  opts: { actor?: Actor; providerName?: string } = {},
) {
  const job = await prisma.predictionJob.create({
    data: {
      patientId,
      provider: opts.providerName,
      requestedBy: opts.actor?.id ?? null,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
    },
  });

  metrics.inc("prediction_jobs_enqueued");
  log.info("queue.enqueue", { jobId: job.id, patientId });
  events.emit("prediction.queued", { jobId: job.id, patientId });

  return job;
}

export async function activeJobFor(patientId: string) {
  return prisma.predictionJob.findFirst({
    where: { patientId, status: { in: ["queued", "processing"] } },
    orderBy: { createdAt: "desc" },
  });
}

// claim and process a single ready job. returns true if a job was handled.
export async function processNextJob() {
  // claim atomically — postgres advisory pattern via update where status='queued'
  const queued = await prisma.predictionJob.findFirst({
    where: { status: "queued", scheduledFor: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
  });
  if (!queued) return false;

  const claimed = await prisma.predictionJob.updateMany({
    where: { id: queued.id, status: "queued" },
    data: { status: "processing", startedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return false; // raced; another worker took it

  const job = await prisma.predictionJob.findUnique({ where: { id: queued.id } });
  if (!job) return true;

  events.emit("prediction.processing", { jobId: job.id, patientId: job.patientId });
  log.info("queue.processing", { jobId: job.id, patientId: job.patientId, attempt: job.attempts });

  const actor = await resolveActor(job.requestedBy);

  try {
    const outcome = await executePrediction(job.patientId, {
      actor,
      providerName: job.provider ?? undefined,
    });

    if (!outcome) {
      // executePrediction returned null — provider failure or no biomarkers
      await failOrRetry(job, "no result from provider");
      return true;
    }

    await prisma.predictionJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        resultId: outcome.log.id,
        error: null,
      },
    });

    metrics.inc("prediction_jobs_completed");
    events.emit("prediction.completed", {
      jobId: job.id,
      patientId: job.patientId,
      riskLevel: outcome.result.riskLevel,
    });

    await applyAutoTransition(job.patientId, actor);
    await fanOutNotifications(job, outcome.result.riskLevel, outcome.result.condition);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    await failOrRetry(job, msg);
    return true;
  }
}

async function failOrRetry(job: PredictionJob, message: string) {
  const next = job.attempts >= job.maxAttempts ? "dead" : "queued";
  await prisma.predictionJob.update({
    where: { id: job.id },
    data: {
      status: next,
      error: message,
      scheduledFor: new Date(Date.now() + RETRY_BACKOFF_MS * job.attempts),
    },
  });

  metrics.inc(next === "dead" ? "prediction_jobs_dead" : "prediction_jobs_retried");
  events.emit("prediction.failed", { jobId: job.id, patientId: job.patientId, error: message });
  log.warn("queue.failed", { jobId: job.id, attempts: job.attempts, terminal: next === "dead", message });

  if (next === "dead") {
    await logAudit({
      action: "predict_fail",
      entityType: "prediction_job",
      entityId: job.id,
      patientId: job.patientId,
      metadata: { message, attempts: job.attempts },
    });
  }
}

async function resolveActor(userId: string | null): Promise<Actor> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  return user ?? null;
}

async function fanOutNotifications(job: PredictionJob, risk: string, condition: string) {
  // notify the assigned clinician (and requester if different) on
  // elevated/critical outcomes only — low/moderate stays quiet
  if (risk !== "critical" && risk !== "elevated") return;
  const patient = await prisma.patient.findUnique({
    where: { id: job.patientId },
    include: { assignedTo: true },
  });
  if (!patient) return;

  const recipients = new Set<string>();
  if (patient.assignedToId) recipients.add(patient.assignedToId);
  if (job.requestedBy) recipients.add(job.requestedBy);

  for (const userId of recipients) {
    await createNotification({
      userId,
      organizationId: patient.organizationId,
      type: risk === "critical" ? "patient_critical" : "prediction_completed",
      title: `${patient.fullName} flagged ${risk}`,
      body: condition,
      link: `/patients/${patient.id}`,
      payload: { patientId: patient.id, riskLevel: risk, jobId: job.id },
    });
  }
}

export async function queueDepth() {
  return prisma.predictionJob.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
}
