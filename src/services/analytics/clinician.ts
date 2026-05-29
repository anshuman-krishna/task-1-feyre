import { prisma } from "@/server/prisma";

// clinician analytics. operators need to understand who's loaded, who's
// idle, and whether assignments are imbalanced. metrics here are
// constructive — load, velocity, ownership — not ranking.

export type ClinicianMetrics = {
  userId: string;
  name: string;
  role: string;
  activePatients: number;
  criticalPatients: number;
  overdueFollowups: number;
  reviewsLast7d: number;
  predictionsLast7d: number;
  loadIndex: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function clinicianMetrics(organizationId: string): Promise<ClinicianMetrics[]> {
  const since = new Date(Date.now() - 7 * DAY_MS);
  const users = await prisma.user.findMany({
    where: { organizationId, archivedAt: null, role: { in: ["clinician", "admin"] } },
    select: { id: true, name: true, role: true },
  });

  const ids = users.map((u) => u.id);
  if (ids.length === 0) return [];

  const [active, critical, overdue, reviews] = await Promise.all([
    prisma.patient.groupBy({
      by: ["assignedToId"],
      where: { organizationId, archivedAt: null, assignedToId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.patient.groupBy({
      by: ["assignedToId"],
      where: {
        organizationId,
        archivedAt: null,
        assignedToId: { in: ids },
        riskLevel: "critical",
      },
      _count: { _all: true },
    }),
    prisma.patient.groupBy({
      by: ["assignedToId"],
      where: {
        organizationId,
        archivedAt: null,
        assignedToId: { in: ids },
        followUpAt: { lte: new Date() },
      },
      _count: { _all: true },
    }),
    prisma.auditLog.groupBy({
      by: ["userId"],
      where: {
        userId: { in: ids },
        action: { in: ["status_change", "note_add", "predict"] },
        createdAt: { gte: since },
      },
      _count: { _all: true },
    }),
  ]);

  const map = <T extends { _count: { _all: number } }>(rows: T[], key: keyof T) =>
    new Map(rows.map((r) => [r[key] as string, r._count._all]));

  const activeMap = map(active, "assignedToId");
  const criticalMap = map(critical, "assignedToId");
  const overdueMap = map(overdue, "assignedToId");
  const reviewMap = map(reviews, "userId");

  return users.map((u) => {
    const activePatients = activeMap.get(u.id) ?? 0;
    const criticalPatients = criticalMap.get(u.id) ?? 0;
    const overdueFollowups = overdueMap.get(u.id) ?? 0;
    const reviewsLast7d = reviewMap.get(u.id) ?? 0;
    const loadIndex =
      activePatients * 1 + criticalPatients * 3 + overdueFollowups * 2;

    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      activePatients,
      criticalPatients,
      overdueFollowups,
      reviewsLast7d,
      predictionsLast7d: reviewsLast7d,
      loadIndex,
    };
  });
}

export type ClinicianInsights = {
  overloaded: ClinicianMetrics[];
  underutilized: ClinicianMetrics[];
  imbalance: { spread: number; mean: number; max: number; min: number };
};

export async function clinicianInsights(organizationId: string): Promise<ClinicianInsights> {
  const metrics = await clinicianMetrics(organizationId);
  if (metrics.length === 0) {
    return { overloaded: [], underutilized: [], imbalance: { spread: 0, mean: 0, max: 0, min: 0 } };
  }
  const loads = metrics.map((m) => m.loadIndex);
  const mean = loads.reduce((a, b) => a + b, 0) / loads.length;
  const max = Math.max(...loads);
  const min = Math.min(...loads);
  const overloaded = metrics.filter((m) => m.loadIndex > mean * 1.4).slice(0, 5);
  const underutilized = metrics
    .filter((m) => m.loadIndex < mean * 0.5 && m.role === "clinician")
    .slice(0, 5);
  return {
    overloaded,
    underutilized,
    imbalance: { spread: max - min, mean: Number(mean.toFixed(1)), max, min },
  };
}
