import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";

// AIRun lineage helpers. every AI artifact carries an aiRunId pointing
// back to one of these rows. callers should never write AIRun directly —
// runAI() in the orchestrator is the single producer.

export type AIRunInsert = {
  organizationId: string;
  task: "patient_summary" | "clinician_handoff" | "critical_digest" | "follow_up_brief";
  promptId: string;
  promptVersion: string;
  provider: string;
  model?: string | null;
  latencyMs: number;
  degraded?: boolean;
  reason?: string | null;
  confidence?: number | null;
  patientId?: string | null;
  actorId?: string | null;
  sourceVersion?: string | null;
  contextSummary?: Prisma.InputJsonValue;
  outputSummary?: Prisma.InputJsonValue;
};

export async function recordAIRun(input: AIRunInsert) {
  return prisma.aIRun.create({
    data: {
      organizationId: input.organizationId,
      task: input.task,
      promptId: input.promptId,
      promptVersion: input.promptVersion,
      provider: input.provider,
      model: input.model ?? null,
      latencyMs: input.latencyMs,
      degraded: input.degraded ?? false,
      reason: input.reason ?? null,
      confidence: input.confidence ?? null,
      patientId: input.patientId ?? null,
      actorId: input.actorId ?? null,
      sourceVersion: input.sourceVersion ?? null,
      contextSummary: input.contextSummary,
      outputSummary: input.outputSummary,
    },
  });
}

// lineage walk for a patient — every AI artifact, summary revision, and
// automation event tied to them, ordered newest first. used by the
// "why did this happen" panel on the patient detail page.
export async function patientLineage(patientId: string, limit = 30) {
  const [runs, revisions, events] = await Promise.all([
    prisma.aIRun.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.summaryRevision.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.automationEvent.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);
  return { runs, revisions, events };
}

export async function recentRuns(organizationId: string, limit = 30) {
  return prisma.aIRun.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function aiUsageReport(
  organizationId: string,
  since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
) {
  return prisma.aIRun.groupBy({
    by: ["task", "provider"],
    where: { organizationId, createdAt: { gte: since } },
    _count: { _all: true },
    _avg: { latencyMs: true, confidence: true },
    _sum: { latencyMs: true },
  });
}
