import type { RiskLevel, WorkflowStatus } from "@prisma/client";
import { prisma } from "@/server/prisma";

export {
  captureDailySnapshot,
  recentSnapshots,
  latestSnapshot,
  metricSeries,
  pickMetric,
  metricList,
} from "./warehouse";
export { METRICS, metricDef, metricsByCategory } from "./metrics";
export type { MetricKey, MetricDef, MetricCategory, MetricUnit } from "./metrics";
export {
  COHORTS,
  cohortMembers,
  captureCohortSnapshots,
  cohortTrend,
  latestCohorts,
} from "./cohorts";
export {
  computeTrajectory,
  recomputeTrajectory,
  recomputeAllTrajectories,
  trajectoryDistribution,
  trajectoriesByDirection,
} from "./trajectory";
export type { TrajectoryDriver, TrajectorySummary } from "./trajectory";
export {
  generateForecast,
  generateAllForecasts,
  latestForecasts,
  forecastMetrics,
  forecastLabel,
} from "./forecasting";
export type { ForecastPayload, ForecastPoint } from "./forecasting";
export { clinicianMetrics, clinicianInsights } from "./clinician";
export type { ClinicianMetrics, ClinicianInsights } from "./clinician";
export { automationHealth, automationEffectiveness } from "./automation";
export type { AutomationHealth, AutomationEffectiveness } from "./automation";
export { aiEffectiveness } from "./ai";
export type { AIEffectiveness } from "./ai";
export {
  generateInsights,
  persistInsights,
  recentInsights,
} from "./insights";
export type { GeneratedInsight } from "./insights";
export { REPORTS, runReport, recentReports } from "./reports";
export { runWarehouse } from "./orchestrator";
export type { WarehouseRunResult } from "./orchestrator";

export type DashboardSummary = {
  activePatients: number;
  predictionsLast24h: number;
  highRiskCount: number;
  avgConfidence: number | null;
  followUpBacklog: number;
  predictionFailures24h: number;
  trends: {
    patients30d: number;
    predictions24hDelta: number;
    highRisk7dDelta: number;
  };
};

export async function dashboardSummary(): Promise<DashboardSummary> {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const last24h = new Date(now.getTime() - day);
  const prev24h = new Date(now.getTime() - 2 * day);
  const last7d = new Date(now.getTime() - 7 * day);
  const prev7d = new Date(now.getTime() - 14 * day);
  const last30d = new Date(now.getTime() - 30 * day);

  const [
    active,
    predictions24,
    predictionsPrev24,
    highRisk,
    highRisk7dAgo,
    confidence,
    created30d,
    followUpBacklog,
    predictionFailures24h,
  ] = await Promise.all([
    prisma.patient.count({ where: { archivedAt: null } }),
    prisma.predictionLog.count({ where: { createdAt: { gte: last24h } } }),
    prisma.predictionLog.count({ where: { createdAt: { gte: prev24h, lt: last24h } } }),
    prisma.patient.count({
      where: { archivedAt: null, riskLevel: { in: ["elevated", "critical"] } },
    }),
    prisma.predictionLog.count({
      where: {
        createdAt: { gte: prev7d, lt: last7d },
        riskLevel: { in: ["elevated", "critical"] },
      },
    }),
    prisma.patient.aggregate({
      where: { archivedAt: null, predictionConfidence: { not: null } },
      _avg: { predictionConfidence: true },
    }),
    prisma.patient.count({ where: { createdAt: { gte: last30d } } }),
    prisma.patient.count({
      where: { archivedAt: null, followUpAt: { lte: now } },
    }),
    prisma.predictionLog.count({
      where: { createdAt: { gte: last24h }, error: { not: null } },
    }),
  ]);

  return {
    activePatients: active,
    predictionsLast24h: predictions24,
    highRiskCount: highRisk,
    avgConfidence: confidence._avg.predictionConfidence,
    followUpBacklog,
    predictionFailures24h,
    trends: {
      patients30d: created30d,
      predictions24hDelta: predictions24 - predictionsPrev24,
      highRisk7dDelta: highRisk - highRisk7dAgo,
    },
  };
}

export async function riskDistribution() {
  const grouped = await prisma.patient.groupBy({
    by: ["riskLevel"],
    where: { archivedAt: null },
    _count: { _all: true },
  });
  const map: Record<RiskLevel | "unassessed", number> = {
    low: 0,
    moderate: 0,
    elevated: 0,
    critical: 0,
    unassessed: 0,
  };
  for (const g of grouped) {
    if (g.riskLevel) map[g.riskLevel] = g._count._all;
    else map.unassessed = g._count._all;
  }
  return map;
}

export async function statusDistribution() {
  const grouped = await prisma.patient.groupBy({
    by: ["status"],
    where: { archivedAt: null },
    _count: { _all: true },
  });
  const map: Record<WorkflowStatus, number> = {
    new_patient: 0,
    monitoring: 0,
    follow_up_needed: 0,
    stable: 0,
    urgent_review: 0,
  };
  for (const g of grouped) map[g.status] = g._count._all;
  return map;
}

export async function predictionThroughput(days = 14) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<{ day: Date; total: bigint; high: bigint }[]>`
    SELECT
      date_trunc('day', "createdAt") AS day,
      COUNT(*)                       AS total,
      COUNT(*) FILTER (
        WHERE "riskLevel" IN ('elevated','critical')
      )                              AS high
    FROM "prediction_logs"
    WHERE "createdAt" >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({
    day: r.day.toISOString(),
    total: Number(r.total),
    high: Number(r.high),
  }));
}

export async function patientGrowth(weeks = 12) {
  const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<{ week: Date; total: bigint }[]>`
    SELECT date_trunc('week', "createdAt") AS week,
           COUNT(*)                        AS total
    FROM "patients"
    WHERE "createdAt" >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({ week: r.week.toISOString(), total: Number(r.total) }));
}

export async function intakeVelocity() {
  const day = 24 * 60 * 60 * 1000;
  const now = new Date();
  const last7d = new Date(now.getTime() - 7 * day);
  const prev7d = new Date(now.getTime() - 14 * day);

  const [last, prev] = await Promise.all([
    prisma.patient.count({ where: { createdAt: { gte: last7d } } }),
    prisma.patient.count({ where: { createdAt: { gte: prev7d, lt: last7d } } }),
  ]);

  return { last7d: last, prev7d: prev, delta: last - prev };
}

export async function biomarkerAverages() {
  const agg = await prisma.patient.aggregate({
    where: { archivedAt: null },
    _avg: {
      glucose: true,
      haemoglobin: true,
      cholesterol: true,
      systolic: true,
      diastolic: true,
      bmi: true,
    },
  });
  return agg._avg;
}

// items that need attention right now
export async function operationalAlerts() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [criticalUnreviewed, followUpDue, failedPredictions] = await Promise.all([
    prisma.patient.findMany({
      where: {
        archivedAt: null,
        riskLevel: "critical",
        OR: [{ reviewedAt: null }, { reviewedAt: { lt: dayAgo } }],
      },
      orderBy: { lastPredictedAt: "desc" },
      take: 5,
      include: { assignedTo: { select: { name: true } } },
    }),
    prisma.patient.findMany({
      where: { archivedAt: null, followUpAt: { lte: now } },
      orderBy: { followUpAt: "asc" },
      take: 5,
      include: { assignedTo: { select: { name: true } } },
    }),
    prisma.predictionLog.findMany({
      where: { createdAt: { gte: dayAgo }, error: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { patient: { select: { fullName: true } } },
    }),
  ]);

  return { criticalUnreviewed, followUpDue, failedPredictions };
}
