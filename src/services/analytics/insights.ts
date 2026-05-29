import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { recentSnapshots, pickMetric } from "./warehouse";
import { latestCohorts } from "./cohorts";
import type { MetricKey } from "./metrics";
import { METRICS } from "./metrics";

// insight engine. deterministic rules over snapshot history that produce
// operator-facing one-liners. "follow-up backlog increased 22% week over
// week" rather than "scroll the charts and look for changes".

export type GeneratedInsight = {
  category: "trend" | "anomaly" | "cohort" | "ai" | "governance";
  severity: "info" | "watch" | "alert";
  headline: string;
  detail: string;
  metricKey?: string;
  rangeStart?: Date;
  rangeEnd?: Date;
  payload?: Record<string, unknown>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const WATCHED: { key: MetricKey; threshold: number; direction: "up" | "down" }[] = [
  { key: "followups_overdue", threshold: 0.2, direction: "up" },
  { key: "approvals_pending", threshold: 0.25, direction: "up" },
  { key: "predictions_total", threshold: 0.3, direction: "down" },
  { key: "critical_patients", threshold: 0.2, direction: "up" },
  { key: "ai_avg_latency_ms", threshold: 0.4, direction: "up" },
  { key: "ai_avg_confidence", threshold: 0.15, direction: "down" },
];

export async function generateInsights(organizationId: string): Promise<GeneratedInsight[]> {
  const snapshots = await recentSnapshots(organizationId, 28);
  if (snapshots.length < 4) return [];

  const insights: GeneratedInsight[] = [];
  const recent = snapshots.slice(-7);
  const prior = snapshots.slice(-14, -7);

  for (const watched of WATCHED) {
    const recentMean = mean(recent.map((s) => pickMetric(s.metrics, watched.key)));
    const priorMean = mean(prior.map((s) => pickMetric(s.metrics, watched.key)));
    if (priorMean === 0) continue;
    const delta = (recentMean - priorMean) / priorMean;
    const def = METRICS[watched.key];
    if (watched.direction === "up" && delta >= watched.threshold) {
      insights.push({
        category: "trend",
        severity: delta >= watched.threshold * 2 ? "alert" : "watch",
        headline: `${def.label} rose ${pct(delta)} week-over-week`,
        detail: `7d mean ${fmt(recentMean)} vs prior week ${fmt(priorMean)} (${def.description.toLowerCase()})`,
        metricKey: watched.key,
        rangeStart: snapshots[snapshots.length - 14]?.capturedFor,
        rangeEnd: snapshots[snapshots.length - 1]?.capturedFor,
        payload: { delta, recentMean, priorMean },
      });
    }
    if (watched.direction === "down" && delta <= -watched.threshold) {
      insights.push({
        category: "trend",
        severity: delta <= -watched.threshold * 2 ? "alert" : "watch",
        headline: `${def.label} dropped ${pct(-delta)} week-over-week`,
        detail: `7d mean ${fmt(recentMean)} vs prior week ${fmt(priorMean)}`,
        metricKey: watched.key,
        rangeStart: snapshots[snapshots.length - 14]?.capturedFor,
        rangeEnd: snapshots[snapshots.length - 1]?.capturedFor,
        payload: { delta, recentMean, priorMean },
      });
    }
  }

  // cohort consecutive trend insights
  const cohorts = await latestCohorts(organizationId);
  for (const c of cohorts) {
    if (!c.latest) continue;
    const trend = await prisma.cohortSnapshot.findMany({
      where: { organizationId, kind: c.kind },
      orderBy: { capturedFor: "desc" },
      take: 5,
    });
    if (trend.length < 3) continue;
    const directions = trend.slice(0, 3).map((t) => Math.sign(t.delta));
    const allDown = directions.every((d) => d < 0);
    const allUp = directions.every((d) => d > 0);
    if (allDown && c.kind === "critical_risk") {
      insights.push({
        category: "cohort",
        severity: "info",
        headline: `Critical cohort shrinking for ${directions.length} consecutive snapshots`,
        detail: `Now ${c.latest.size}, down ${Math.abs(c.latest.delta)} since last snapshot.`,
        metricKey: "critical_patients",
      });
    }
    if (allUp && (c.kind === "followup_overdue" || c.kind === "unreviewed_critical")) {
      insights.push({
        category: "cohort",
        severity: "watch",
        headline: `${c.def.label} cohort growing for ${directions.length} consecutive snapshots`,
        detail: `Now ${c.latest.size}, up ${c.latest.delta} since last snapshot.`,
      });
    }
  }

  return insights;
}

export async function persistInsights(
  organizationId: string,
  insights: GeneratedInsight[],
) {
  if (insights.length === 0) return 0;
  await prisma.operationalInsight.createMany({
    data: insights.map((i) => ({
      organizationId,
      category: i.category,
      severity: i.severity,
      headline: i.headline,
      detail: i.detail ?? null,
      metricKey: i.metricKey ?? null,
      rangeStart: i.rangeStart ?? null,
      rangeEnd: i.rangeEnd ?? null,
      payload: (i.payload ?? null) as Prisma.InputJsonValue,
    })),
  });
  return insights.length;
}

export async function recentInsights(organizationId: string, days = 14) {
  const since = new Date(Date.now() - days * DAY_MS);
  return prisma.operationalInsight.findMany({
    where: { organizationId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function fmt(v: number): string {
  if (Math.abs(v) >= 100) return Math.round(v).toString();
  return v.toFixed(1);
}
