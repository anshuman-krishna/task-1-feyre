import { prisma } from "@/server/prisma";
import { runAI, type AIRun } from "@/services/ai";
import { logAudit, type Actor } from "@/services/audit";
import type {
  DigestOutput,
  FollowUpBriefOutput,
  HandoffOutput,
} from "@/services/ai";

// the copilot exposes a small, opinionated set of operational queries.
// these aren't open chat — each action assembles a tight context envelope
// and runs it through the AI orchestrator. outputs are structured so the
// UI can render them confidently.

export type CopilotAction =
  | "urgent_review"
  | "unresolved_criticals"
  | "clinician_handoff";

export type CopilotResponse = {
  action: CopilotAction;
  output: HandoffOutput | DigestOutput | FollowUpBriefOutput;
  meta: AIRun["meta"];
  runId: string;
};

export async function runCopilot(
  action: CopilotAction,
  opts: { organizationId: string; actor?: Actor },
): Promise<CopilotResponse> {
  const result =
    action === "urgent_review"
      ? await urgentReview(opts.organizationId, opts.actor?.id)
      : action === "unresolved_criticals"
        ? await unresolvedCriticals(opts.organizationId, opts.actor?.id)
        : await clinicianHandoff(opts.organizationId, opts.actor);

  await logAudit({
    action: "copilot_query",
    entityType: "copilot",
    entityId: action,
    actor: opts.actor,
    metadata: {
      action,
      provider: result.meta.provider,
      latencyMs: result.meta.latencyMs,
      degraded: result.meta.degraded,
      runId: result.runId,
    },
  });

  return { action, output: result.output, meta: result.meta, runId: result.runId };
}

async function urgentReview(organizationId: string, actorId?: string | null) {
  const now = new Date();
  const candidates = await prisma.patient.findMany({
    where: {
      organizationId,
      archivedAt: null,
      OR: [
        { riskLevel: "critical" },
        { status: "urgent_review" },
        { followUpAt: { lte: now } },
      ],
    },
    orderBy: { lastPredictedAt: "desc" },
    take: 12,
    include: { assignedTo: { select: { name: true } } },
  });

  const patients = candidates.slice(0, 8).map((p) => ({
    name: p.fullName,
    reason: composeUrgencyReason(p, now),
    risk: p.riskLevel,
  }));

  return runAI<FollowUpBriefOutput>(
    "follow_up_brief",
    { patients },
    { organizationId, actorId: actorId ?? null },
  );
}

async function unresolvedCriticals(organizationId: string, actorId?: string | null) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [unresolvedCriticalRaw, overdueFollowUpsRaw, predictionFailuresRaw] = await Promise.all([
    prisma.patient.findMany({
      where: {
        organizationId,
        archivedAt: null,
        riskLevel: "critical",
        OR: [{ reviewedAt: null }, { reviewedAt: { lt: dayAgo } }],
      },
      orderBy: { lastPredictedAt: "asc" },
      take: 8,
      select: { fullName: true, lastPredictedAt: true },
    }),
    prisma.patient.findMany({
      where: { organizationId, archivedAt: null, followUpAt: { lte: now } },
      orderBy: { followUpAt: "asc" },
      take: 8,
      select: { fullName: true, followUpAt: true },
    }),
    prisma.predictionLog.findMany({
      where: {
        createdAt: { gte: dayAgo },
        error: { not: null },
        patient: { organizationId },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { patient: { select: { fullName: true } } },
    }),
  ]);

  const unresolvedCritical = unresolvedCriticalRaw.map((p) => ({
    name: p.fullName,
    daysFlagged: p.lastPredictedAt
      ? Math.max(0, Math.round((now.getTime() - p.lastPredictedAt.getTime()) / 86_400_000))
      : 0,
  }));
  const overdueFollowUps = overdueFollowUpsRaw.map((p) => ({
    name: p.fullName,
    daysOverdue: p.followUpAt
      ? Math.max(0, Math.round((now.getTime() - p.followUpAt.getTime()) / 86_400_000))
      : 0,
  }));
  const predictionFailures = predictionFailuresRaw.map((p) => ({
    name: p.patient.fullName,
    reason: p.error ?? "unknown error",
  }));

  return runAI<DigestOutput>(
    "critical_digest",
    { unresolvedCritical, overdueFollowUps, predictionFailures },
    { organizationId, actorId: actorId ?? null },
  );
}

async function clinicianHandoff(organizationId: string, actor?: Actor) {
  const userId = actor?.id;
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    : null;
  const name = user?.name ?? "the on-call clinician";

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [urgent, followUp, awaitingReview] = await Promise.all([
    prisma.patient.findMany({
      where: {
        organizationId,
        archivedAt: null,
        OR: [{ riskLevel: "critical" }, { status: "urgent_review" }],
        ...(userId ? { assignedToId: userId } : {}),
      },
      orderBy: { lastPredictedAt: "desc" },
      take: 6,
      select: { fullName: true, riskLevel: true, aiPrediction: true },
    }),
    prisma.patient.findMany({
      where: {
        organizationId,
        archivedAt: null,
        followUpAt: { lte: now },
        ...(userId ? { assignedToId: userId } : {}),
      },
      orderBy: { followUpAt: "asc" },
      take: 6,
      select: { fullName: true, riskLevel: true, followUpAt: true },
    }),
    prisma.patient.findMany({
      where: {
        organizationId,
        archivedAt: null,
        riskLevel: { in: ["elevated", "critical"] },
        OR: [{ reviewedAt: null }, { reviewedAt: { lt: dayAgo } }],
        ...(userId ? { assignedToId: userId } : {}),
      },
      take: 6,
      select: { fullName: true, riskLevel: true },
    }),
  ]);

  const ctx = {
    user: { name },
    caseload: {
      urgent: urgent.map((p) => ({
        name: p.fullName,
        reason: p.aiPrediction ?? "critical-tier outcome",
        risk: p.riskLevel ?? "critical",
      })),
      followUp: followUp.map((p) => ({
        name: p.fullName,
        reason: p.followUpAt
          ? `follow-up due ${formatRelDays(p.followUpAt, now)}`
          : "follow-up pending",
        risk: p.riskLevel,
      })),
      awaitingReview: awaitingReview.map((p) => ({
        name: p.fullName,
        risk: p.riskLevel,
      })),
    },
  };

  return runAI<HandoffOutput>("clinician_handoff", ctx, {
    organizationId,
    actorId: actor?.id ?? null,
  });
}

function composeUrgencyReason(
  p: {
    riskLevel: string | null;
    status: string;
    followUpAt: Date | null;
    reviewedAt: Date | null;
    aiPrediction: string | null;
  },
  now: Date,
): string {
  const segments: string[] = [];
  if (p.riskLevel === "critical") segments.push("critical risk");
  if (p.status === "urgent_review") segments.push("marked urgent review");
  if (p.followUpAt && p.followUpAt.getTime() <= now.getTime()) {
    const days = Math.max(0, Math.round((now.getTime() - p.followUpAt.getTime()) / 86_400_000));
    segments.push(`follow-up overdue ${days}d`);
  }
  if (!p.reviewedAt && p.riskLevel === "critical") segments.push("never reviewed");
  if (segments.length === 0) segments.push(p.aiPrediction ?? "flagged by intelligence layer");
  return segments.join(" · ");
}

function formatRelDays(d: Date, now: Date) {
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  return `in ${days}d`;
}
