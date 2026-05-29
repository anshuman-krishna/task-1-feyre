import type { CohortKind, Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { log as logger } from "@/server/logger";

// cohort engine. each cohort is a deterministic query against the live
// patient set. snapshots persist daily sizes so we can chart growth /
// shrinkage without recomputing membership across the whole history.

export type CohortDef = {
  kind: CohortKind;
  label: string;
  description: string;
};

export const COHORTS: Record<CohortKind, CohortDef> = {
  critical_risk: {
    kind: "critical_risk",
    label: "Critical risk",
    description: "Patients currently classified critical.",
  },
  elevated_risk: {
    kind: "elevated_risk",
    label: "Elevated risk",
    description: "Patients currently classified elevated.",
  },
  followup_overdue: {
    kind: "followup_overdue",
    label: "Follow-up overdue",
    description: "Patients with a follow-up date in the past.",
  },
  recurring_anomaly: {
    kind: "recurring_anomaly",
    label: "Recurring anomalies",
    description: "Patients with anomalies firing across ≥2 recent runs.",
  },
  high_improvement: {
    kind: "high_improvement",
    label: "High improvement",
    description: "Patients whose risk has reduced ≥1 band recently.",
  },
  newly_critical: {
    kind: "newly_critical",
    label: "Newly critical",
    description: "Patients who escalated to critical in the last 7 days.",
  },
  newly_stable: {
    kind: "newly_stable",
    label: "Newly stable",
    description: "Patients whose status moved to stable in the last 7 days.",
  },
  unreviewed_critical: {
    kind: "unreviewed_critical",
    label: "Unreviewed critical",
    description: "Critical patients without review in the last 24 hours.",
  },
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function cohortMembers(
  organizationId: string,
  kind: CohortKind,
  limit = 200,
): Promise<{ id: string; fullName: string }[]> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const base = { organizationId, archivedAt: null } as const;

  switch (kind) {
    case "critical_risk":
      return prisma.patient.findMany({
        where: { ...base, riskLevel: "critical" },
        select: { id: true, fullName: true },
        take: limit,
        orderBy: { lastPredictedAt: "desc" },
      });
    case "elevated_risk":
      return prisma.patient.findMany({
        where: { ...base, riskLevel: "elevated" },
        select: { id: true, fullName: true },
        take: limit,
        orderBy: { lastPredictedAt: "desc" },
      });
    case "followup_overdue":
      return prisma.patient.findMany({
        where: { ...base, followUpAt: { lte: now } },
        select: { id: true, fullName: true },
        take: limit,
        orderBy: { followUpAt: "asc" },
      });
    case "unreviewed_critical":
      return prisma.patient.findMany({
        where: {
          ...base,
          riskLevel: "critical",
          OR: [{ reviewedAt: null }, { reviewedAt: { lt: dayAgo } }],
        },
        select: { id: true, fullName: true },
        take: limit,
        orderBy: { lastPredictedAt: "desc" },
      });
    case "newly_critical": {
      const audits = await prisma.auditLog.findMany({
        where: {
          patient: { organizationId },
          action: "predict",
          createdAt: { gte: weekAgo },
        },
        select: { patientId: true },
        distinct: ["patientId"],
        take: limit,
      });
      const ids = audits.map((a) => a.patientId).filter((x): x is string => !!x);
      return prisma.patient.findMany({
        where: { ...base, id: { in: ids }, riskLevel: "critical" },
        select: { id: true, fullName: true },
        take: limit,
      });
    }
    case "newly_stable":
      return prisma.patient.findMany({
        where: { ...base, status: "stable", updatedAt: { gte: weekAgo } },
        select: { id: true, fullName: true },
        take: limit,
        orderBy: { updatedAt: "desc" },
      });
    case "high_improvement":
      return improvedPatients(organizationId, limit);
    case "recurring_anomaly":
      return recurringAnomalyPatients(organizationId, limit);
  }
}

async function improvedPatients(organizationId: string, limit: number) {
  // patients whose two most recent predictions show a risk band reduction.
  const rows = await prisma.$queryRaw<{ id: string; fullname: string }[]>`
    WITH ranked AS (
      SELECT pl."patientId" AS id,
             pl."riskLevel",
             pl."createdAt",
             ROW_NUMBER() OVER (PARTITION BY pl."patientId" ORDER BY pl."createdAt" DESC) AS rn
      FROM "prediction_logs" pl
      JOIN "patients" p ON p.id = pl."patientId"
      WHERE p."organizationId" = ${organizationId}
        AND p."archivedAt" IS NULL
    ),
    pairs AS (
      SELECT id,
             MAX(CASE WHEN rn = 1 THEN "riskLevel"::text END) AS latest,
             MAX(CASE WHEN rn = 2 THEN "riskLevel"::text END) AS prior
      FROM ranked
      WHERE rn <= 2
      GROUP BY id
    )
    SELECT p.id, p."fullName" AS fullname
    FROM pairs
    JOIN "patients" p ON p.id = pairs.id
    WHERE pairs.prior IS NOT NULL
      AND CASE pairs.prior
            WHEN 'critical' THEN 3 WHEN 'elevated' THEN 2
            WHEN 'moderate' THEN 1 ELSE 0 END
        - CASE pairs.latest
            WHEN 'critical' THEN 3 WHEN 'elevated' THEN 2
            WHEN 'moderate' THEN 1 ELSE 0 END >= 1
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ id: r.id, fullName: r.fullname }));
}

async function recurringAnomalyPatients(organizationId: string, limit: number) {
  const rows = await prisma.$queryRaw<{ id: string; fullname: string }[]>`
    SELECT p.id, p."fullName" AS fullname
    FROM "patients" p
    JOIN "automation_events" e ON e."patientId" = p.id
    WHERE p."organizationId" = ${organizationId}
      AND p."archivedAt" IS NULL
      AND e."trigger" = 'biomarker_anomaly'
      AND e."createdAt" >= NOW() - INTERVAL '14 days'
    GROUP BY p.id
    HAVING COUNT(e.id) >= 2
    ORDER BY MAX(e."createdAt") DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ id: r.id, fullName: r.fullname }));
}

export async function captureCohortSnapshots(organizationId: string, day = new Date()) {
  const start = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
  );

  // last snapshot per cohort for delta calc
  const previous = await prisma.cohortSnapshot.findMany({
    where: { organizationId, capturedFor: { lt: start } },
    orderBy: { capturedFor: "desc" },
    take: Object.keys(COHORTS).length * 4,
  });
  const lastByKind = new Map<CohortKind, number>();
  for (const row of previous) {
    if (!lastByKind.has(row.kind)) lastByKind.set(row.kind, row.size);
  }

  const results: { kind: CohortKind; size: number; delta: number }[] = [];

  for (const kind of Object.keys(COHORTS) as CohortKind[]) {
    const members = await cohortMembers(organizationId, kind, 25);
    const fullSize = await cohortSize(organizationId, kind);
    const previousSize = lastByKind.get(kind) ?? 0;
    const delta = fullSize - previousSize;

    await prisma.cohortSnapshot.upsert({
      where: {
        organizationId_kind_capturedFor: {
          organizationId,
          kind,
          capturedFor: start,
        },
      },
      create: {
        organizationId,
        kind,
        capturedFor: start,
        size: fullSize,
        delta,
        sampleIds: members.map((m) => m.id) as unknown as Prisma.InputJsonValue,
      },
      update: {
        size: fullSize,
        delta,
        sampleIds: members.map((m) => m.id) as unknown as Prisma.InputJsonValue,
      },
    });

    results.push({ kind, size: fullSize, delta });
  }

  logger.info("analytics.cohorts.captured", { organizationId, count: results.length });
  return results;
}

async function cohortSize(organizationId: string, kind: CohortKind): Promise<number> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const base = { organizationId, archivedAt: null } as const;

  switch (kind) {
    case "critical_risk":
      return prisma.patient.count({ where: { ...base, riskLevel: "critical" } });
    case "elevated_risk":
      return prisma.patient.count({ where: { ...base, riskLevel: "elevated" } });
    case "followup_overdue":
      return prisma.patient.count({ where: { ...base, followUpAt: { lte: now } } });
    case "unreviewed_critical":
      return prisma.patient.count({
        where: {
          ...base,
          riskLevel: "critical",
          OR: [{ reviewedAt: null }, { reviewedAt: { lt: dayAgo } }],
        },
      });
    case "newly_stable":
      return prisma.patient.count({
        where: { ...base, status: "stable", updatedAt: { gte: weekAgo } },
      });
    case "newly_critical":
    case "recurring_anomaly":
    case "high_improvement": {
      const m = await cohortMembers(organizationId, kind, 500);
      return m.length;
    }
  }
}

export async function cohortTrend(
  organizationId: string,
  kind: CohortKind,
  days = 30,
) {
  const since = new Date(Date.now() - days * DAY_MS);
  const rows = await prisma.cohortSnapshot.findMany({
    where: { organizationId, kind, capturedFor: { gte: since } },
    orderBy: { capturedFor: "asc" },
  });
  return rows.map((r) => ({
    at: r.capturedFor.toISOString().slice(0, 10),
    size: r.size,
    delta: r.delta,
  }));
}

export async function latestCohorts(organizationId: string) {
  const kinds = Object.keys(COHORTS) as CohortKind[];
  const results = await Promise.all(
    kinds.map(async (kind) => {
      const latest = await prisma.cohortSnapshot.findFirst({
        where: { organizationId, kind },
        orderBy: { capturedFor: "desc" },
      });
      return { kind, def: COHORTS[kind], latest };
    }),
  );
  return results;
}
