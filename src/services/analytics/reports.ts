import type { Prisma, ReportKind } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { log as logger } from "@/server/logger";
import type { CsvReport } from "@/services/governance/reports";
import { recentSnapshots, pickMetric } from "./warehouse";
import { latestCohorts } from "./cohorts";
import { clinicianMetrics } from "./clinician";
import { aiEffectiveness } from "./ai";
import { automationHealth } from "./automation";
import { trajectoryDistribution } from "./trajectory";
import { metricList } from "./warehouse";

// reporting engine. each kind builds a CSV-shaped artifact AND a structured
// summary. structured summaries land on the admin Reports page; CSV is what
// gets downloaded. all runs persist as `ReportRun` rows for cost tracking
// and scheduling later.

const DAY_MS = 24 * 60 * 60 * 1000;

export const REPORTS: Record<ReportKind, { label: string; description: string }> = {
  executive_overview: {
    label: "Executive overview",
    description: "High-level state of the clinic: growth, risk, automation, AI usage.",
  },
  cohort_overview: {
    label: "Cohort overview",
    description: "Latest sizes and deltas for every cohort.",
  },
  clinician_workload: {
    label: "Clinician workload",
    description: "Caseload distribution, critical patients, review velocity.",
  },
  ai_effectiveness: {
    label: "AI effectiveness",
    description: "Provider mix, confidence, degradation, summary throughput.",
  },
  automation_health: {
    label: "Automation health",
    description: "Rule fire counts, approval acceptance, confidence skips.",
  },
  governance_throughput: {
    label: "Governance throughput",
    description: "Approval volumes, decisions, policy changes.",
  },
  anomaly_trends: {
    label: "Anomaly trends",
    description: "Anomaly frequency, recurrence, cohorts driving spikes.",
  },
  retention_outlook: {
    label: "Retention outlook",
    description: "Upcoming retention sweeps and consent distribution.",
  },
};

export async function runReport(
  organizationId: string,
  kind: ReportKind,
  rangeDays = 30,
): Promise<{ csv: CsvReport; summary: Record<string, unknown> }> {
  const started = Date.now();
  const rangeStart = new Date(Date.now() - rangeDays * DAY_MS);
  const rangeEnd = new Date();

  const result = await BUILDERS[kind](organizationId, rangeStart, rangeEnd);

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - started;

  await prisma.reportRun.create({
    data: {
      organizationId,
      kind,
      startedAt: new Date(started),
      finishedAt,
      durationMs,
      rangeStart,
      rangeEnd,
      status: "ok",
      summary: result.summary as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info("analytics.report", { organizationId, kind, durationMs });
  return result;
}

const BUILDERS: Record<
  ReportKind,
  (
    organizationId: string,
    rangeStart: Date,
    rangeEnd: Date,
  ) => Promise<{ csv: CsvReport; summary: Record<string, unknown> }>
> = {
  executive_overview: async (orgId) => {
    const snapshots = await recentSnapshots(orgId, 30);
    const latest = snapshots[snapshots.length - 1];
    const first = snapshots[0];
    if (!latest || !first) {
      return { csv: { header: ["metric", "value"], rows: [] }, summary: { snapshots: 0 } };
    }
    const keys = metricList();
    const rows = keys.map((k) => [
      k,
      pickMetric(latest.metrics, k),
      pickMetric(first.metrics, k),
      pickMetric(latest.metrics, k) - pickMetric(first.metrics, k),
    ]);
    return {
      csv: { header: ["metric", "current", "thirty_days_ago", "delta"], rows },
      summary: { snapshots: snapshots.length, currentDay: latest.capturedFor },
    };
  },

  cohort_overview: async (orgId) => {
    const cohorts = await latestCohorts(orgId);
    return {
      csv: {
        header: ["kind", "label", "size", "delta", "captured_for"],
        rows: cohorts.map((c) => [
          c.kind,
          c.def.label,
          c.latest?.size ?? 0,
          c.latest?.delta ?? 0,
          c.latest?.capturedFor.toISOString().slice(0, 10) ?? null,
        ]),
      },
      summary: { cohorts: cohorts.length },
    };
  },

  clinician_workload: async (orgId) => {
    const ms = await clinicianMetrics(orgId);
    return {
      csv: {
        header: [
          "user_id",
          "name",
          "role",
          "active",
          "critical",
          "overdue",
          "reviews_7d",
          "load_index",
        ],
        rows: ms.map((m) => [
          m.userId,
          m.name,
          m.role,
          m.activePatients,
          m.criticalPatients,
          m.overdueFollowups,
          m.reviewsLast7d,
          m.loadIndex,
        ]),
      },
      summary: { clinicians: ms.length },
    };
  },

  ai_effectiveness: async (orgId) => {
    const e = await aiEffectiveness(orgId);
    return {
      csv: {
        header: ["provider", "runs", "avg_latency_ms", "avg_confidence"],
        rows: e.byProvider.map((p) => [
          p.provider,
          p.runs,
          p.avgLatencyMs,
          p.avgConfidence ?? null,
        ]),
      },
      summary: {
        totalRuns: e.totalRuns,
        degradedRate: e.degradedRate,
        summariesPendingReview: e.summariesPendingReview,
      },
    };
  },

  automation_health: async (orgId) => {
    const h = await automationHealth(orgId);
    return {
      csv: {
        header: ["rule_key", "rule_name", "fires", "last_fired_at"],
        rows: h.byRule.map((r) => [
          r.ruleKey,
          r.ruleName,
          r.fires,
          r.lastFiredAt?.toISOString() ?? null,
        ]),
      },
      summary: {
        totalFires7d: h.totalFires7d,
        acceptanceRate: h.acceptanceRate,
      },
    };
  },

  governance_throughput: async (orgId, rangeStart) => {
    const rows = await prisma.approval.groupBy({
      by: ["kind", "state"],
      where: { organizationId: orgId, createdAt: { gte: rangeStart } },
      _count: { _all: true },
    });
    return {
      csv: {
        header: ["approval_kind", "state", "count"],
        rows: rows.map((r) => [r.kind, r.state, r._count._all]),
      },
      summary: { grouped: rows.length },
    };
  },

  anomaly_trends: async (orgId, rangeStart) => {
    const rows = await prisma.automationEvent.groupBy({
      by: ["trigger"],
      where: {
        organizationId: orgId,
        trigger: "biomarker_anomaly",
        createdAt: { gte: rangeStart },
      },
      _count: { _all: true },
    });
    const traj = await trajectoryDistribution(orgId);
    return {
      csv: {
        header: ["bucket", "kind", "count"],
        rows: [
          ...rows.map((r) => ["trigger", r.trigger, r._count._all] as const).map((t) => [...t]),
          ...Object.entries(traj).map(([dir, n]) => ["trajectory", dir, n]),
        ],
      },
      summary: { trajectory: traj },
    };
  },

  retention_outlook: async (orgId) => {
    const now = new Date();
    const upcoming = await prisma.patient.findMany({
      where: {
        organizationId: orgId,
        archivedAt: null,
        retentionUntil: { not: null, lte: new Date(now.getTime() + 60 * DAY_MS) },
      },
      select: { id: true, fullName: true, retentionUntil: true, consentResearch: true, consentDataSharing: true },
      orderBy: { retentionUntil: "asc" },
    });
    return {
      csv: {
        header: ["patient_id", "name", "retention_until", "consent_research", "consent_sharing"],
        rows: upcoming.map((p) => [
          p.id,
          p.fullName,
          p.retentionUntil?.toISOString().slice(0, 10) ?? null,
          p.consentResearch ? "true" : "false",
          p.consentDataSharing ? "true" : "false",
        ]),
      },
      summary: { upcomingExpirations: upcoming.length },
    };
  },
};

export async function recentReports(organizationId: string, limit = 20) {
  return prisma.reportRun.findMany({
    where: { organizationId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}
