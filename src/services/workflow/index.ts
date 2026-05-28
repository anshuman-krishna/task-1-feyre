import type { RiskLevel, WorkflowStatus } from "@prisma/client";

// risk-driven workflow defaults. clinicians can always override; this is the
// nudge the system applies when a new prediction lands and the patient is
// still in their default state.

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

// re-derive only when the patient is still on a "soft" state (new or stable).
// once a clinician moves the patient into monitoring/follow_up/urgent we
// respect their decision until they archive or reset.
export function shouldAutoTransition(current: WorkflowStatus) {
  return current === "new_patient" || current === "stable";
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
