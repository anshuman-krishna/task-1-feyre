import type { RiskLevel } from "@prisma/client";
import { prisma } from "@/server/prisma";

export type DashboardSummary = {
  activePatients: number;
  predictionsLast24h: number;
  highRiskCount: number;
  avgConfidence: number | null;
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

  const [active, predictions24, predictionsPrev24, highRisk, highRisk7dAgo, confidence, created30d] =
    await Promise.all([
      prisma.patient.count({ where: { archivedAt: null } }),
      prisma.predictionLog.count({ where: { createdAt: { gte: last24h } } }),
      prisma.predictionLog.count({
        where: { createdAt: { gte: prev24h, lt: last24h } },
      }),
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
    ]);

  return {
    activePatients: active,
    predictionsLast24h: predictions24,
    highRiskCount: highRisk,
    avgConfidence: confidence._avg.predictionConfidence,
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

// last 14 days, prediction throughput
export async function predictionThroughput(days = 14) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // raw, single-pass query for date bucketing
  const rows = await prisma.$queryRaw<{ day: Date; total: bigint; high: bigint }[]>`
    SELECT
      date_trunc('day', "createdAt")              AS day,
      COUNT(*)                                    AS total,
      COUNT(*) FILTER (
        WHERE "riskLevel" IN ('elevated','critical')
      )                                           AS high
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

// last 12 weeks, patient growth
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
