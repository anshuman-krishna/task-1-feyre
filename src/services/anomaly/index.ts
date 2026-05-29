import { loadPatientMemory } from "@/services/ai/memory";
import { fireAutomation } from "@/services/automation";

// anomaly detection. lightweight, explainable, deterministic.
// surfaces three classes of signal:
//   1. biomarker spikes (z-score >= 2 against the patient's own history)
//   2. recurring elevated/critical observations (≥2 consecutive assessments)
//   3. workflow inconsistencies (missing review, stalled follow-up)

export type AnomalySignal = {
  kind: "biomarker_spike" | "recurring_flag" | "workflow_gap";
  label: string;
  detail: string;
  severity: "watch" | "concern" | "urgent";
};

export async function detectAnomalies(patientId: string): Promise<AnomalySignal[]> {
  const memory = await loadPatientMemory(patientId);
  if (!memory) return [];

  const signals: AnomalySignal[] = [];

  for (const spike of memory.spikes) {
    signals.push({
      kind: "biomarker_spike",
      label: spike.label,
      detail: `Latest reading ${spike.current.toFixed(1)} vs baseline ${spike.baseline.toFixed(1)} (z=${spike.z.toFixed(2)})`,
      severity: Math.abs(spike.z) >= 3 ? "urgent" : "concern",
    });
  }

  for (const flag of memory.recurringFlags) {
    if (flag.occurrences < 2) continue;
    signals.push({
      kind: "recurring_flag",
      label: flag.label,
      detail: `Outside reference range across ${flag.occurrences} consecutive assessments.`,
      severity: flag.occurrences >= 3 ? "concern" : "watch",
    });
  }

  if (
    memory.workflow.daysSinceReview != null &&
    memory.workflow.daysSinceReview > 14 &&
    (memory.latest?.riskLevel === "elevated" || memory.latest?.riskLevel === "critical")
  ) {
    signals.push({
      kind: "workflow_gap",
      label: "Stale clinician review",
      detail: `Critical-tier patient last reviewed ${memory.workflow.daysSinceReview} days ago.`,
      severity: "concern",
    });
  }

  if (memory.workflow.followUpDueInDays != null && memory.workflow.followUpDueInDays < -3) {
    signals.push({
      kind: "workflow_gap",
      label: "Follow-up severely overdue",
      detail: `Follow-up is ${Math.abs(memory.workflow.followUpDueInDays)} days past due.`,
      severity: "urgent",
    });
  }

  return signals;
}

// hook for the queue worker — detects anomalies after a fresh prediction
// and fans them through the automation engine. one trigger per spike so
// dedup logic in createNotification can suppress repeats per groupKey.
export async function detectAndDispatchAnomalies(
  patientId: string,
  organizationId: string,
) {
  const memory = await loadPatientMemory(patientId);
  if (!memory) return;
  for (const spike of memory.spikes) {
    await fireAutomation("biomarker_anomaly", {
      organizationId,
      patientId,
      payload: { label: spike.label, current: spike.current, baseline: spike.baseline, z: spike.z },
    });
  }
}

// scan all org patients for follow-up overdue + critical_unreviewed signals.
// intended to be called by a periodic sweep (cron-style) — for now triggered
// from the deep health endpoint and on-demand for admins.
export async function sweepOrganizationalAnomalies(organizationId: string) {
  const { prisma } = await import("@/server/prisma");
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const overdue = await prisma.patient.findMany({
    where: { organizationId, archivedAt: null, followUpAt: { lte: now } },
    select: { id: true, followUpAt: true },
  });
  for (const p of overdue) {
    const days = Math.round((now.getTime() - p.followUpAt!.getTime()) / 86_400_000);
    await fireAutomation("follow_up_overdue", {
      organizationId,
      patientId: p.id,
      payload: { daysOverdue: days },
    });
  }

  const unreviewed = await prisma.patient.findMany({
    where: {
      organizationId,
      archivedAt: null,
      riskLevel: "critical",
      OR: [{ reviewedAt: null }, { reviewedAt: { lt: dayAgo } }],
    },
    select: { id: true, lastPredictedAt: true, reviewedAt: true },
  });
  for (const p of unreviewed) {
    const base = p.reviewedAt ?? p.lastPredictedAt ?? new Date();
    const hours = (now.getTime() - base.getTime()) / 3_600_000;
    await fireAutomation("critical_unreviewed", {
      organizationId,
      patientId: p.id,
      payload: { hoursUnreviewed: hours },
    });
  }

  return { overdueScanned: overdue.length, criticalScanned: unreviewed.length };
}
