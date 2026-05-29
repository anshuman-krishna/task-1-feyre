import type { Prisma, TrajectoryDirection } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { loadPatientMemory } from "@/services/ai/memory";
import { events } from "@/server/events";

// patient trajectory engine. consumes the longitudinal memory we already
// assemble for AI runs and produces a single explainable health-direction
// score plus contributing drivers. cached per patient so the UI doesn't
// recompute on every render.

export type TrajectoryDriver = {
  label: string;
  weight: number;
  detail: string;
};

export type TrajectorySummary = {
  direction: TrajectoryDirection;
  score: number;
  confidence: number;
  drivers: TrajectoryDriver[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function computeTrajectory(patientId: string): Promise<TrajectorySummary | null> {
  const memory = await loadPatientMemory(patientId);
  if (!memory) return null;

  const drivers: TrajectoryDriver[] = [];
  let score = 0;

  // base direction from risk-band trajectory
  if (memory.trajectory.direction === "improving") {
    score -= 30;
    drivers.push({
      label: "Risk band improving",
      weight: -30,
      detail: `${memory.trajectory.sampleCount} runs over ${memory.trajectory.spanDays}d`,
    });
  } else if (memory.trajectory.direction === "worsening") {
    score += 30;
    drivers.push({
      label: "Risk band worsening",
      weight: 30,
      detail: `${memory.trajectory.sampleCount} runs over ${memory.trajectory.spanDays}d`,
    });
  } else if (memory.trajectory.direction === "volatile") {
    score += 12;
    drivers.push({
      label: "Volatile risk pattern",
      weight: 12,
      detail: `${memory.trajectory.sampleCount} runs, multiple reversals`,
    });
  }

  // biomarker spikes push toward deteriorating
  for (const spike of memory.spikes) {
    const weight = Math.min(15, Math.round(Math.abs(spike.z) * 5));
    score += weight;
    drivers.push({
      label: `${spike.label} spike`,
      weight,
      detail: `z=${spike.z.toFixed(2)} vs baseline ${spike.baseline.toFixed(1)}`,
    });
  }

  // recurring observations
  for (const flag of memory.recurringFlags) {
    if (flag.occurrences < 2) continue;
    const weight = Math.min(10, flag.occurrences * 3);
    score += weight;
    drivers.push({
      label: `${flag.label} recurring`,
      weight,
      detail: `outside reference range across ${flag.occurrences} runs`,
    });
  }

  // workflow gaps
  if (
    memory.workflow.daysSinceReview != null &&
    memory.workflow.daysSinceReview > 14 &&
    (memory.latest?.riskLevel === "elevated" || memory.latest?.riskLevel === "critical")
  ) {
    score += 5;
    drivers.push({
      label: "Stale clinician review",
      weight: 5,
      detail: `${memory.workflow.daysSinceReview} days since last review`,
    });
  }

  if (
    memory.workflow.followUpDueInDays != null &&
    memory.workflow.followUpDueInDays < -7
  ) {
    const overdue = -memory.workflow.followUpDueInDays;
    score += Math.min(10, overdue);
    drivers.push({
      label: "Follow-up overdue",
      weight: Math.min(10, overdue),
      detail: `${overdue}d past due`,
    });
  }

  const direction: TrajectoryDirection =
    memory.trajectory.direction === "volatile"
      ? "volatile"
      : score >= 20
        ? "deteriorating"
        : score <= -20
          ? "improving"
          : "stable";

  const confidence =
    Math.min(memory.trajectory.sampleCount / 6, 1) * 0.6 +
    (drivers.length > 1 ? 0.3 : drivers.length * 0.15) +
    0.1;

  return {
    direction,
    score: Math.max(-100, Math.min(100, score)),
    confidence: Number(Math.min(1, confidence).toFixed(2)),
    drivers,
  };
}

export async function recomputeTrajectory(patientId: string) {
  const result = await computeTrajectory(patientId);
  if (!result) {
    await prisma.trajectoryScore.deleteMany({ where: { patientId } });
    return null;
  }
  await prisma.trajectoryScore.upsert({
    where: { patientId },
    create: {
      patientId,
      direction: result.direction,
      score: result.score,
      confidence: result.confidence,
      drivers: result.drivers as unknown as Prisma.InputJsonValue,
    },
    update: {
      direction: result.direction,
      score: result.score,
      confidence: result.confidence,
      drivers: result.drivers as unknown as Prisma.InputJsonValue,
      computedAt: new Date(),
    },
  });
  events.emit("trajectory.recomputed", {
    patientId,
    direction: result.direction,
    score: result.score,
  });
  return result;
}

export async function recomputeAllTrajectories(organizationId: string) {
  const patients = await prisma.patient.findMany({
    where: { organizationId, archivedAt: null },
    select: { id: true },
  });
  let count = 0;
  for (const p of patients) {
    const r = await recomputeTrajectory(p.id);
    if (r) count += 1;
  }
  return count;
}

export async function trajectoryDistribution(organizationId: string) {
  const grouped = await prisma.trajectoryScore.groupBy({
    by: ["direction"],
    where: { patient: { organizationId, archivedAt: null } },
    _count: { _all: true },
  });
  const out: Record<TrajectoryDirection, number> = {
    improving: 0,
    stable: 0,
    deteriorating: 0,
    volatile: 0,
  };
  for (const g of grouped) out[g.direction] = g._count._all;
  return out;
}

export async function trajectoriesByDirection(
  organizationId: string,
  direction: TrajectoryDirection,
  limit = 10,
) {
  return prisma.trajectoryScore.findMany({
    where: { patient: { organizationId, archivedAt: null }, direction },
    orderBy: direction === "deteriorating" ? { score: "desc" } : { score: "asc" },
    take: limit,
    include: {
      patient: {
        select: {
          id: true,
          fullName: true,
          riskLevel: true,
          status: true,
          assignedTo: { select: { name: true } },
        },
      },
    },
  });
}

export function trendWindowDays(): number {
  return Math.round(30 * (DAY_MS / DAY_MS));
}
