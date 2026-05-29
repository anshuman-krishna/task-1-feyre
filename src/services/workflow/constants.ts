import type { WorkflowStatus } from "@prisma/client";

// client-safe workflow labels + order. kept separate from the server-only
// transition logic in ./index.ts so client bundles don't pull in node:events.

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
