import type { RiskLevel, WorkflowStatus } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { logAudit, type Actor } from "@/services/audit";
import { events } from "@/server/events";

const DAY = 24 * 60 * 60 * 1000;

export function suggestStatus(risk: RiskLevel): WorkflowStatus {
  switch (risk) {
    case "critical":
      return "urgent_review";
    case "elevated":
      return "follow_up_needed";
    case "moderate":
      return "monitoring";
    case "low":
      return "stable";
  }
}

export function suggestFollowUp(risk: RiskLevel, from = new Date()): Date | null {
  const days = risk === "critical" ? 1 : risk === "elevated" ? 7 : risk === "moderate" ? 30 : null;
  return days == null ? null : new Date(from.getTime() + days * DAY);
}

export function shouldAutoTransition(current: WorkflowStatus) {
  return current === "new_patient" || current === "stable";
}

// called by the queue worker after a successful prediction. honours the
// "only nudge while in a soft state" rule.
export async function applyAutoTransition(patientId: string, actor?: Actor) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient?.riskLevel) return;
  if (!shouldAutoTransition(patient.status)) return;

  const next = suggestStatus(patient.riskLevel);
  const followUpAt = suggestFollowUp(patient.riskLevel);
  if (next === patient.status && !followUpAt) return;

  await prisma.patient.update({
    where: { id: patientId },
    data: { status: next, followUpAt },
  });

  await logAudit({
    action: "status_change",
    entityType: "patient",
    entityId: patientId,
    patientId,
    actor,
    metadata: { from: patient.status, to: next, auto: true, reason: patient.riskLevel },
  });

  events.emit("patient.status_changed", { patientId, status: next });
}

export const STATUS_LABELS: Record<WorkflowStatus, string> = {
  new_patient: "New",
  monitoring: "Monitoring",
  follow_up_needed: "Follow-up needed",
  stable: "Stable",
  urgent_review: "Urgent review",
};

export const STATUS_ORDER: WorkflowStatus[] = [
  "urgent_review",
  "follow_up_needed",
  "monitoring",
  "new_patient",
  "stable",
];
