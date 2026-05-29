import type { RiskLevel } from "@prisma/client";

// risk + biomarker trajectory analysis. takes a chronological list of
// predictions (oldest first) and emits readable signals.

const RISK_WEIGHT: Record<RiskLevel, number> = {
  low: 0,
  moderate: 1,
  elevated: 2,
  critical: 3,
};

export type Trajectory = {
  direction: "improving" | "stable" | "worsening" | "volatile" | "unknown";
  delta: number;
  sampleCount: number;
  spanDays: number;
};

export function trajectoryFromPredictions(
  rows: { riskLevel: RiskLevel; createdAt: Date }[],
): Trajectory {
  if (rows.length < 2) {
    return {
      direction: "unknown",
      delta: 0,
      sampleCount: rows.length,
      spanDays: 0,
    };
  }
  const weights = rows.map((r) => RISK_WEIGHT[r.riskLevel]);
  const first = weights[0]!;
  const last = weights[weights.length - 1]!;
  const delta = last - first;

  // count direction reversals to detect volatility
  let reversals = 0;
  for (let i = 2; i < weights.length; i++) {
    const a = weights[i - 2]!;
    const b = weights[i - 1]!;
    const c = weights[i]!;
    if ((b - a) * (c - b) < 0) reversals += 1;
  }

  const spanMs = rows[rows.length - 1]!.createdAt.getTime() - rows[0]!.createdAt.getTime();
  const spanDays = Math.max(0, Math.round(spanMs / (24 * 60 * 60 * 1000)));

  let direction: Trajectory["direction"];
  if (reversals >= 2) direction = "volatile";
  else if (delta > 0) direction = "worsening";
  else if (delta < 0) direction = "improving";
  else direction = "stable";

  return { direction, delta, sampleCount: rows.length, spanDays };
}

export type RecurringFlag = { label: string; occurrences: number };

// returns biomarker labels that have been non-ok for ≥2 consecutive
// prediction runs. used both for memory observations and the anomaly layer.
export function recurringObservations(
  rows: { observations: { label: string; status: string }[] }[],
): RecurringFlag[] {
  if (rows.length === 0) return [];
  const counts: Record<string, number> = {};
  // walk from newest to oldest; count consecutive non-ok runs per label
  const latestRow = rows[rows.length - 1]?.observations ?? [];
  for (const obs of latestRow) {
    if (obs.status === "ok") continue;
    let streak = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      const match = rows[i]!.observations.find((o) => o.label === obs.label);
      if (match && match.status !== "ok") streak += 1;
      else break;
    }
    if (streak >= 1) counts[obs.label] = streak;
  }
  return Object.entries(counts)
    .map(([label, occurrences]) => ({ label, occurrences }))
    .sort((a, b) => b.occurrences - a.occurrences);
}

// detect biomarker spikes — a sudden jump above the patient's recent baseline.
// returns one entry per biomarker that has spiked in the most recent run.
export type BiomarkerSpike = {
  label: string;
  current: number;
  baseline: number;
  z: number;
};

export function biomarkerSpikes(
  values: { label: string; values: { value: number | null; at: Date }[] }[],
  minSamples = 3,
): BiomarkerSpike[] {
  const spikes: BiomarkerSpike[] = [];
  for (const series of values) {
    const numeric = series.values
      .filter((v): v is { value: number; at: Date } => v.value != null)
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    if (numeric.length < minSamples) continue;
    const current = numeric[numeric.length - 1]!.value;
    const prior = numeric.slice(0, -1).map((v) => v.value);
    const mean = prior.reduce((s, x) => s + x, 0) / prior.length;
    const variance = prior.reduce((s, x) => s + (x - mean) ** 2, 0) / prior.length;
    const std = Math.sqrt(variance);
    if (std === 0) continue;
    const z = (current - mean) / std;
    if (Math.abs(z) >= 2) {
      spikes.push({ label: series.label, current, baseline: mean, z });
    }
  }
  return spikes;
}
