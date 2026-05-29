import type { ForecastMetric, Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { log as logger } from "@/server/logger";
import { recentSnapshots, pickMetric } from "./warehouse";
import type { MetricKey } from "./metrics";

// lightweight forecasting. moving average + linear extrapolation against
// recent daily snapshots. produces an "expected range" rather than a hard
// future value — planning is the use case, not certainty.

const DAY_MS = 24 * 60 * 60 * 1000;

const METRIC_KEY: Record<ForecastMetric, MetricKey> = {
  patient_growth: "active_patients",
  prediction_volume: "predictions_total",
  followup_demand: "followups_overdue",
  review_backlog: "unreviewed_critical",
  critical_volume: "critical_patients",
};

const LABEL: Record<ForecastMetric, string> = {
  patient_growth: "Patient population",
  prediction_volume: "Prediction volume",
  followup_demand: "Follow-up demand",
  review_backlog: "Review backlog",
  critical_volume: "Critical caseload",
};

export type ForecastPoint = {
  at: string;
  value: number;
  low?: number;
  high?: number;
};

export type ForecastPayload = {
  metric: ForecastMetric;
  label: string;
  unit: string;
  horizonDays: number;
  history: ForecastPoint[];
  projection: ForecastPoint[];
  method: "moving_average" | "linear_trend";
  confidence: number;
  generatedAt: string;
};

export async function generateForecast(
  organizationId: string,
  metric: ForecastMetric,
  horizonDays = 14,
): Promise<ForecastPayload> {
  const key = METRIC_KEY[metric];
  const snapshots = await recentSnapshots(organizationId, 60);
  const history: ForecastPoint[] = snapshots.map((s) => ({
    at: s.capturedFor.toISOString().slice(0, 10),
    value: pickMetric(s.metrics, key),
  }));

  const projection = project(history, horizonDays);
  const method: ForecastPayload["method"] =
    history.length >= 7 ? "linear_trend" : "moving_average";
  const confidence = Number(Math.min(1, history.length / 21).toFixed(2));

  const payload: ForecastPayload = {
    metric,
    label: LABEL[metric],
    unit: metric === "patient_growth" ? "patients" : "count",
    horizonDays,
    history,
    projection,
    method,
    confidence,
    generatedAt: new Date().toISOString(),
  };

  await prisma.forecastSnapshot.create({
    data: {
      organizationId,
      metric,
      horizonDays,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info("analytics.forecast", { organizationId, metric, horizonDays });
  return payload;
}

function project(history: ForecastPoint[], horizonDays: number): ForecastPoint[] {
  if (history.length === 0) return [];
  const values = history.map((h) => h.value);
  const window = values.slice(-7);
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  const std = Math.sqrt(window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length);

  let slope = 0;
  if (values.length >= 2) {
    const n = values.length;
    const xs = values.map((_, i) => i);
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - xMean) * (values[i]! - yMean), 0);
    const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0) || 1;
    slope = num / den;
  }

  const lastDay = history[history.length - 1]!.at;
  const lastDate = new Date(lastDay + "T00:00:00Z");

  const projection: ForecastPoint[] = [];
  for (let i = 1; i <= horizonDays; i++) {
    const next = new Date(lastDate.getTime() + i * DAY_MS);
    const trendValue = mean + slope * i;
    const value = Math.max(0, Math.round(trendValue));
    const spread = Math.max(1, Math.round(std + Math.abs(slope) * i * 0.5));
    projection.push({
      at: next.toISOString().slice(0, 10),
      value,
      low: Math.max(0, value - spread),
      high: value + spread,
    });
  }
  return projection;
}

export async function generateAllForecasts(organizationId: string, horizonDays = 14) {
  const metrics: ForecastMetric[] = [
    "patient_growth",
    "prediction_volume",
    "followup_demand",
    "review_backlog",
    "critical_volume",
  ];
  const out: ForecastPayload[] = [];
  for (const m of metrics) {
    out.push(await generateForecast(organizationId, m, horizonDays));
  }
  return out;
}

export async function latestForecasts(organizationId: string) {
  const metrics: ForecastMetric[] = [
    "patient_growth",
    "prediction_volume",
    "followup_demand",
    "review_backlog",
    "critical_volume",
  ];
  const out: { metric: ForecastMetric; payload: ForecastPayload | null }[] = [];
  for (const metric of metrics) {
    const row = await prisma.forecastSnapshot.findFirst({
      where: { organizationId, metric },
      orderBy: { generatedAt: "desc" },
    });
    out.push({
      metric,
      payload: row ? (row.payload as unknown as ForecastPayload) : null,
    });
  }
  return out;
}

export function forecastMetrics(): ForecastMetric[] {
  return ["patient_growth", "prediction_volume", "followup_demand", "review_backlog", "critical_volume"];
}

export function forecastLabel(metric: ForecastMetric): string {
  return LABEL[metric];
}
