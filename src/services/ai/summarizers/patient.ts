import type { Prisma, SummaryApprovalState } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { events } from "@/server/events";
import { logAudit, type Actor } from "@/services/audit";
import { tenantOf } from "@/services/tenant";
import { policyConfig } from "@/services/governance/policy";
import { loadPatientMemory } from "../memory";
import { runAI } from "../orchestration";
import { promptFor } from "../prompts";
import type { PatientSummaryOutput } from "../types";

// summary generation. fingerprint-aware: if the stored summary's
// sourceVersion still matches and force === false, we return the cache.

export type StoredSummary = {
  id: string;
  patientId: string;
  overview: string;
  trajectory: string;
  observations: PatientSummaryOutput["observations"];
  recommendedActions: PatientSummaryOutput["recommendedActions"];
  confidence: number;
  generatedBy: string;
  model: string | null;
  sourceVersion: string;
  revision: number;
  promptVersion: string;
  promptId: string;
  approvalState: SummaryApprovalState;
  aiRunId: string | null;
  createdAt: Date;
  updatedAt: Date;
  stale: boolean;
  lowConfidence: boolean;
};

export async function getPatientSummary(patientId: string): Promise<StoredSummary | null> {
  const row = await prisma.patientSummary.findUnique({ where: { patientId } });
  if (!row) return null;
  const [memory, threshold] = await Promise.all([
    loadPatientMemory(patientId),
    confidenceThresholdFor(row.patientId),
  ]);
  const stale = memory ? memory.sourceVersion !== row.sourceVersion : false;
  return mapStored(row, stale, threshold);
}

export async function listSummaryRevisions(patientId: string, limit = 12) {
  return prisma.summaryRevision.findMany({
    where: { patientId },
    orderBy: { revision: "desc" },
    take: limit,
  });
}

type RefreshOpts = {
  force?: boolean;
  actor?: Actor;
  providerName?: string;
  reason?: string;
};

export async function refreshPatientSummary(
  patientId: string,
  opts: RefreshOpts = {},
): Promise<StoredSummary | null> {
  const memory = await loadPatientMemory(patientId);
  if (!memory) return null;

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { organizationId: true },
  });
  if (!patient) return null;

  const existing = await prisma.patientSummary.findUnique({ where: { patientId } });
  const threshold = await confidenceThresholdFor(patientId);
  if (existing && !opts.force && existing.sourceVersion === memory.sourceVersion) {
    return mapStored(existing, false, threshold);
  }

  const prompt = promptFor("patient_summary");
  const requiresApproval = await summariesNeedApproval(patient.organizationId);

  const run = await runAI<PatientSummaryOutput>(
    "patient_summary",
    {
      patient: memory.patient,
      latest: memory.latest,
      trajectory: memory.trajectory,
      recurringFlags: memory.recurringFlags,
      workflow: memory.workflow,
      noteCount: memory.noteCount,
    },
    {
      providerName: opts.providerName,
      organizationId: patient.organizationId,
      patientId,
      actorId: opts.actor?.id ?? null,
      sourceVersion: memory.sourceVersion,
    },
  );

  const nextRevision = (existing?.revision ?? 0) + 1;
  const approvalState: SummaryApprovalState = requiresApproval ? "pending_review" : "published";

  const stored = await prisma.patientSummary.upsert({
    where: { patientId },
    create: {
      patientId,
      overview: run.output.overview,
      trajectory: run.output.trajectory,
      observations: run.output.observations as unknown as Prisma.InputJsonValue,
      recommendedActions: run.output.recommendedActions as unknown as Prisma.InputJsonValue,
      confidence: run.output.confidence,
      generatedBy: run.meta.provider,
      model: run.meta.model,
      sourceVersion: memory.sourceVersion,
      revision: nextRevision,
      promptVersion: prompt.version,
      promptId: prompt.id,
      aiRunId: run.runId,
      approvalState,
    },
    update: {
      overview: run.output.overview,
      trajectory: run.output.trajectory,
      observations: run.output.observations as unknown as Prisma.InputJsonValue,
      recommendedActions: run.output.recommendedActions as unknown as Prisma.InputJsonValue,
      confidence: run.output.confidence,
      generatedBy: run.meta.provider,
      model: run.meta.model,
      sourceVersion: memory.sourceVersion,
      revision: nextRevision,
      promptVersion: prompt.version,
      promptId: prompt.id,
      aiRunId: run.runId,
      approvalState,
    },
  });

  await prisma.summaryRevision.create({
    data: {
      patientId,
      revision: nextRevision,
      overview: run.output.overview,
      trajectory: run.output.trajectory,
      observations: run.output.observations as unknown as Prisma.InputJsonValue,
      recommendedActions: run.output.recommendedActions as unknown as Prisma.InputJsonValue,
      confidence: run.output.confidence,
      generatedBy: run.meta.provider,
      model: run.meta.model,
      sourceVersion: memory.sourceVersion,
      promptVersion: prompt.version,
      promptId: prompt.id,
      aiRunId: run.runId,
      approvalState,
    },
  });

  await logAudit({
    action: "summary_refresh",
    entityType: "patient",
    entityId: patientId,
    patientId,
    actor: opts.actor,
    metadata: {
      provider: run.meta.provider,
      latencyMs: run.meta.latencyMs,
      degraded: run.meta.degraded,
      reason: opts.reason ?? "manual",
      runId: run.runId,
      revision: nextRevision,
      promptVersion: prompt.version,
      approvalState,
    },
  });

  events.emit("activity.recorded", { action: "summary_refresh", patientId });
  events.emit("summary.refreshed", { patientId });

  return mapStored(stored, false, threshold);
}

export async function publishPatientSummary(
  patientId: string,
  actor?: Actor,
): Promise<StoredSummary | null> {
  const summary = await prisma.patientSummary.findUnique({ where: { patientId } });
  if (!summary) return null;
  if (summary.approvalState === "published") {
    const threshold = await confidenceThresholdFor(patientId);
    return mapStored(summary, false, threshold);
  }
  const next = await prisma.patientSummary.update({
    where: { patientId },
    data: { approvalState: "published" },
  });
  await prisma.summaryRevision.updateMany({
    where: { patientId, revision: summary.revision },
    data: { approvalState: "published" },
  });
  await logAudit({
    action: "approval_decided",
    entityType: "patient_summary",
    entityId: patientId,
    patientId,
    actor,
    metadata: { decision: "approved", revision: summary.revision },
  });
  events.emit("summary.refreshed", { patientId });
  const threshold = await confidenceThresholdFor(patientId);
  return mapStored(next, false, threshold);
}

async function summariesNeedApproval(organizationId: string): Promise<boolean> {
  const cfg = await policyConfig(organizationId, "approval");
  return Boolean((cfg as Record<string, unknown>).summariesRequireApproval);
}

async function confidenceThresholdFor(patientId: string): Promise<number> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { organizationId: true },
  });
  if (!patient) return 0.6;
  const cfg = await policyConfig(patient.organizationId, "confidence");
  const v = (cfg as Record<string, unknown>).minSummaryConfidence;
  return typeof v === "number" ? v : 0.6;
}

function mapStored(
  row: Awaited<ReturnType<typeof prisma.patientSummary.findUnique>>,
  stale: boolean,
  confidenceThreshold: number,
): StoredSummary | null {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patientId,
    overview: row.overview,
    trajectory: row.trajectory,
    observations: (row.observations ?? []) as StoredSummary["observations"],
    recommendedActions: (row.recommendedActions ?? []) as StoredSummary["recommendedActions"],
    confidence: row.confidence,
    generatedBy: row.generatedBy,
    model: row.model,
    sourceVersion: row.sourceVersion,
    revision: row.revision,
    promptVersion: row.promptVersion,
    promptId: row.promptId,
    approvalState: row.approvalState,
    aiRunId: row.aiRunId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    stale,
    lowConfidence: row.confidence < confidenceThreshold,
  };
}
