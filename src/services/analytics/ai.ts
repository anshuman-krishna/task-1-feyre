import { prisma } from "@/server/prisma";

// AI effectiveness analytics. usage, latency, confidence distributions,
// summary quality. answers "is the AI we ship actually performing?"

const DAY_MS = 24 * 60 * 60 * 1000;

export type AIEffectiveness = {
  windowDays: number;
  totalRuns: number;
  byProvider: { provider: string; runs: number; avgLatencyMs: number; avgConfidence: number | null }[];
  byTask: { task: string; runs: number; avgConfidence: number | null }[];
  degradedRuns: number;
  degradedRate: number | null;
  summaryRegenerations: number;
  summariesPendingReview: number;
  summariesPublished: number;
  confidenceDistribution: { bucket: string; count: number }[];
};

export async function aiEffectiveness(
  organizationId: string,
  windowDays = 14,
): Promise<AIEffectiveness> {
  const since = new Date(Date.now() - windowDays * DAY_MS);

  const [
    totalRuns,
    byProvider,
    byTask,
    degradedRuns,
    revisions,
    summariesPending,
    summariesPublished,
    runs,
  ] = await Promise.all([
    prisma.aIRun.count({ where: { organizationId, createdAt: { gte: since } } }),
    prisma.aIRun.groupBy({
      by: ["provider"],
      where: { organizationId, createdAt: { gte: since } },
      _count: { _all: true },
      _avg: { latencyMs: true, confidence: true },
    }),
    prisma.aIRun.groupBy({
      by: ["task"],
      where: { organizationId, createdAt: { gte: since } },
      _count: { _all: true },
      _avg: { confidence: true },
    }),
    prisma.aIRun.count({
      where: { organizationId, createdAt: { gte: since }, degraded: true },
    }),
    prisma.summaryRevision.count({
      where: {
        patient: { organizationId },
        createdAt: { gte: since },
      },
    }),
    prisma.patientSummary.count({
      where: {
        patient: { organizationId },
        approvalState: "pending_review",
      },
    }),
    prisma.patientSummary.count({
      where: {
        patient: { organizationId },
        approvalState: "published",
      },
    }),
    prisma.aIRun.findMany({
      where: { organizationId, createdAt: { gte: since }, confidence: { not: null } },
      select: { confidence: true },
    }),
  ]);

  const buckets = [
    { label: "<0.5", lower: 0, upper: 0.5 },
    { label: "0.5–0.7", lower: 0.5, upper: 0.7 },
    { label: "0.7–0.85", lower: 0.7, upper: 0.85 },
    { label: "≥0.85", lower: 0.85, upper: 1.01 },
  ];
  const counts = buckets.map((b) => ({
    bucket: b.label,
    count: runs.filter((r) => r.confidence! >= b.lower && r.confidence! < b.upper).length,
  }));

  return {
    windowDays,
    totalRuns,
    byProvider: byProvider.map((p) => ({
      provider: p.provider,
      runs: p._count._all,
      avgLatencyMs: p._avg.latencyMs ? Math.round(p._avg.latencyMs) : 0,
      avgConfidence: p._avg.confidence ?? null,
    })),
    byTask: byTask.map((t) => ({
      task: t.task,
      runs: t._count._all,
      avgConfidence: t._avg.confidence ?? null,
    })),
    degradedRuns,
    degradedRate: totalRuns === 0 ? null : degradedRuns / totalRuns,
    summaryRegenerations: revisions,
    summariesPendingReview: summariesPending,
    summariesPublished: summariesPublished,
    confidenceDistribution: counts,
  };
}
