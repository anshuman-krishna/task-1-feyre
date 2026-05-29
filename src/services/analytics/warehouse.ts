import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { log as logger } from "@/server/logger";
import { metrics as runtimeMetrics } from "@/server/metrics";
import { METRICS, type MetricKey } from "./metrics";

// daily snapshot engine. computes the metric set for an organization
// across the window [00:00 captureDay, 00:00 next day) — predictions,
// approvals, automation, ai-run counts; plus point-in-time tallies that
// don't fit the window model (patients, pending approvals, etc.).
//
// snapshots are idempotent per (organization, grain, capturedFor). a
// second call for the same day upserts the row so backfills are safe.

export type MetricRow = Partial<Record<MetricKey, number>>;

const DAY_MS = 24 * 60 * 60 * 1000;

export function dayBoundary(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + DAY_MS);
  return { start, end };
}

export async function captureDailySnapshot(organizationId: string, day = new Date()) {
  const started = Date.now();
  const { start, end } = dayBoundary(day);

  const row = await collectMetrics(organizationId, { start, end });

  const result = await prisma.analyticsSnapshot.upsert({
    where: {
      organizationId_grain_capturedFor: {
        organizationId,
        grain: "daily",
        capturedFor: start,
      },
    },
    create: {
      organizationId,
      grain: "daily",
      capturedFor: start,
      metrics: row as unknown as Prisma.InputJsonValue,
      durationMs: Date.now() - started,
    },
    update: {
      metrics: row as unknown as Prisma.InputJsonValue,
      durationMs: Date.now() - started,
    },
  });

  runtimeMetrics.inc("analytics_snapshots_captured");
  runtimeMetrics.observe("analytics_snapshot_duration_ms", result.durationMs);
  logger.info("analytics.snapshot", {
    organizationId,
    capturedFor: start.toISOString(),
    durationMs: result.durationMs,
  });

  return { row, snapshot: result };
}

async function collectMetrics(
  organizationId: string,
  window: { start: Date; end: Date },
): Promise<MetricRow> {
  const dayAgo = new Date(window.end.getTime() - DAY_MS);

  const [
    active,
    urgent,
    critical,
    elevated,
    followupsOverdue,
    unreviewedCritical,
    predictions,
    predictionFailures,
    automationFires,
    approvalsPending,
    approvalsDecided,
    aiRuns,
    notifications,
    clinicianRows,
    recurringAnomalyPatients,
  ] = await Promise.all([
    prisma.patient.count({ where: { organizationId, archivedAt: null } }),
    prisma.patient.count({
      where: { organizationId, archivedAt: null, status: "urgent_review" },
    }),
    prisma.patient.count({
      where: { organizationId, archivedAt: null, riskLevel: "critical" },
    }),
    prisma.patient.count({
      where: { organizationId, archivedAt: null, riskLevel: "elevated" },
    }),
    prisma.patient.count({
      where: {
        organizationId,
        archivedAt: null,
        followUpAt: { lte: window.end },
      },
    }),
    prisma.patient.count({
      where: {
        organizationId,
        archivedAt: null,
        riskLevel: "critical",
        OR: [{ reviewedAt: null }, { reviewedAt: { lt: dayAgo } }],
      },
    }),
    prisma.predictionLog.count({
      where: {
        patient: { organizationId },
        createdAt: { gte: window.start, lt: window.end },
      },
    }),
    prisma.predictionLog.count({
      where: {
        patient: { organizationId },
        createdAt: { gte: window.start, lt: window.end },
        error: { not: null },
      },
    }),
    prisma.automationEvent.count({
      where: { organizationId, createdAt: { gte: window.start, lt: window.end } },
    }),
    prisma.approval.count({ where: { organizationId, state: "pending" } }),
    prisma.approval.count({
      where: {
        organizationId,
        decidedAt: { gte: window.start, lt: window.end },
      },
    }),
    prisma.aIRun.count({
      where: { organizationId, createdAt: { gte: window.start, lt: window.end } },
    }),
    prisma.notification.count({
      where: { organizationId, createdAt: { gte: window.start, lt: window.end } },
    }),
    prisma.patient.groupBy({
      by: ["assignedToId"],
      where: { organizationId, archivedAt: null, assignedToId: { not: null } },
      _count: { _all: true },
    }),
    countRecurringAnomalyPatients(organizationId),
  ]);

  const aiAgg = await prisma.aIRun.aggregate({
    where: { organizationId, createdAt: { gte: window.start, lt: window.end } },
    _avg: { latencyMs: true, confidence: true },
  });

  const loads = clinicianRows.map((r) => r._count._all);
  const loadAvg = loads.length === 0 ? 0 : loads.reduce((a, b) => a + b, 0) / loads.length;
  const loadMax = loads.length === 0 ? 0 : Math.max(...loads);

  return {
    active_patients: active,
    urgent_patients: urgent,
    critical_patients: critical,
    elevated_patients: elevated,
    followups_overdue: followupsOverdue,
    unreviewed_critical: unreviewedCritical,
    predictions_total: predictions,
    prediction_failures: predictionFailures,
    automation_fires: automationFires,
    approvals_pending: approvalsPending,
    approvals_decided: approvalsDecided,
    ai_runs: aiRuns,
    ai_avg_latency_ms: aiAgg._avg.latencyMs ? Math.round(aiAgg._avg.latencyMs) : 0,
    ai_avg_confidence:
      aiAgg._avg.confidence != null ? Number(aiAgg._avg.confidence.toFixed(3)) : 0,
    notifications_total: notifications,
    clinician_load_avg: Number(loadAvg.toFixed(2)),
    clinician_load_max: loadMax,
    recurring_anomaly_patients: recurringAnomalyPatients,
  };
}

async function countRecurringAnomalyPatients(organizationId: string) {
  const rows = await prisma.$queryRaw<{ patientid: string }[]>`
    SELECT DISTINCT p.id AS patientid
    FROM "patients" p
    JOIN "automation_events" e ON e."patientId" = p.id
    WHERE p."organizationId" = ${organizationId}
      AND p."archivedAt" IS NULL
      AND e."trigger" = 'biomarker_anomaly'
      AND e."createdAt" >= NOW() - INTERVAL '14 days'
    GROUP BY p.id
    HAVING COUNT(e.id) >= 2
  `;
  return rows.length;
}

export async function recentSnapshots(organizationId: string, days = 30) {
  const since = new Date(Date.now() - days * DAY_MS);
  return prisma.analyticsSnapshot.findMany({
    where: { organizationId, capturedFor: { gte: since } },
    orderBy: { capturedFor: "asc" },
  });
}

export async function metricSeries(
  organizationId: string,
  key: MetricKey,
  days = 30,
): Promise<{ at: string; value: number }[]> {
  const snapshots = await recentSnapshots(organizationId, days);
  return snapshots.map((s) => ({
    at: s.capturedFor.toISOString().slice(0, 10),
    value: pickMetric(s.metrics, key),
  }));
}

export function pickMetric(metrics: unknown, key: MetricKey): number {
  if (!metrics || typeof metrics !== "object") return 0;
  const raw = (metrics as Record<string, unknown>)[key];
  return typeof raw === "number" ? raw : 0;
}

export async function latestSnapshot(organizationId: string) {
  return prisma.analyticsSnapshot.findFirst({
    where: { organizationId, grain: "daily" },
    orderBy: { capturedFor: "desc" },
  });
}

export function metricList(): MetricKey[] {
  return Object.keys(METRICS) as MetricKey[];
}
