import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { events } from "@/server/events";

// patient priority scoring. produces a 0..100 score with an explainable
// reason set so the dashboard's "attention now" queue can defend its order.

type PriorityReason = { label: string; weight: number };

type PriorityResult = {
  score: number;
  band: "now" | "soon" | "watch" | "quiet";
  reasons: PriorityReason[];
};

const RISK_SCORE: Record<string, number> = {
  critical: 40,
  elevated: 25,
  moderate: 12,
  low: 4,
};

export async function computePriority(patientId: string): Promise<PriorityResult | null> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      predictions: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!patient || patient.archivedAt) return null;

  const reasons: PriorityReason[] = [];
  let score = 0;

  if (patient.riskLevel) {
    const w = RISK_SCORE[patient.riskLevel] ?? 0;
    score += w;
    reasons.push({ label: `Risk: ${patient.riskLevel}`, weight: w });
  }

  // freshness: a recent prediction without review is louder
  if (patient.lastPredictedAt && !patient.reviewedAt) {
    const hours = (Date.now() - patient.lastPredictedAt.getTime()) / 3_600_000;
    if (hours < 48 && (patient.riskLevel === "critical" || patient.riskLevel === "elevated")) {
      score += 15;
      reasons.push({ label: "Unreviewed since last assessment", weight: 15 });
    }
  }

  // overdue follow-up
  if (patient.followUpAt && patient.followUpAt.getTime() < Date.now()) {
    const days = Math.round((Date.now() - patient.followUpAt.getTime()) / 86_400_000);
    const w = Math.min(20, 6 + days * 2);
    score += w;
    reasons.push({ label: `Follow-up overdue ${days}d`, weight: w });
  }

  // trajectory: worsening across recent predictions
  if (patient.predictions.length >= 2) {
    const ordered = [...patient.predictions].reverse(); // oldest -> newest
    const first = riskValue(ordered[0]?.riskLevel);
    const last = riskValue(ordered[ordered.length - 1]?.riskLevel);
    if (last - first >= 1) {
      score += 10;
      reasons.push({ label: "Risk trending up", weight: 10 });
    }
  }

  // urgent_review status floor
  if (patient.status === "urgent_review") {
    score += 5;
    reasons.push({ label: "Marked urgent review", weight: 5 });
  }

  const band = bandFor(score);
  return { score: Math.round(score), band, reasons };
}

export async function recomputePriority(patientId: string) {
  const result = await computePriority(patientId);
  if (!result) {
    await prisma.priorityScore.deleteMany({ where: { patientId } });
    return null;
  }
  await prisma.priorityScore.upsert({
    where: { patientId },
    create: {
      patientId,
      score: result.score,
      band: result.band,
      reasons: result.reasons as unknown as Prisma.InputJsonValue,
    },
    update: {
      score: result.score,
      band: result.band,
      reasons: result.reasons as unknown as Prisma.InputJsonValue,
      computedAt: new Date(),
    },
  });
  events.emit("priority.recomputed", {
    patientId,
    score: result.score,
    band: result.band,
  });
  return result;
}

export async function topPriority(organizationId: string, limit = 8) {
  return prisma.priorityScore.findMany({
    where: { patient: { organizationId, archivedAt: null } },
    orderBy: { score: "desc" },
    take: limit,
    include: {
      patient: {
        select: {
          id: true,
          fullName: true,
          riskLevel: true,
          status: true,
          followUpAt: true,
          lastPredictedAt: true,
          assignedTo: { select: { name: true, avatarHue: true } },
        },
      },
    },
  });
}

export async function recomputeAllPriorities(organizationId: string) {
  const patients = await prisma.patient.findMany({
    where: { organizationId, archivedAt: null },
    select: { id: true },
  });
  for (const p of patients) {
    await recomputePriority(p.id);
  }
  return patients.length;
}

function riskValue(r: string | null | undefined): number {
  if (!r) return -1;
  return ["low", "moderate", "elevated", "critical"].indexOf(r);
}

function bandFor(score: number): PriorityResult["band"] {
  if (score >= 50) return "now";
  if (score >= 25) return "soon";
  if (score >= 10) return "watch";
  return "quiet";
}
