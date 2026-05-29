import type { AutomationRule } from "./types";

// built-in rule registry. v1 ships a small, opinionated set of rules
// that cover the most credible operational paths. enable/disable lives
// in the AutomationRule table per organization; rule logic itself is
// code, not data — that lands when a no-code editor is needed.

export const BUILTIN_RULES: AutomationRule[] = [
  {
    key: "notify_on_critical_prediction",
    name: "Notify assignee on critical outcome",
    description:
      "Sends a high-priority notification to the patient's assigned clinician whenever a prediction lands in the critical band.",
    trigger: "prediction_completed",
    actions: [
      { kind: "notify", priority: "critical", channel: "assignee" },
      { kind: "notify", priority: "high", channel: "requester" },
    ],
    evaluate(ctx) {
      const risk = ctx.payload.riskLevel as string | undefined;
      return risk === "critical" ? "prediction outcome is critical" : null;
    },
  },
  {
    key: "refresh_summary_after_prediction",
    name: "Refresh patient summary",
    description:
      "Regenerates the cached patient summary in the background after every prediction so clinicians always read the latest model output.",
    trigger: "prediction_completed",
    actions: [{ kind: "refresh_summary" }],
    evaluate(ctx) {
      return ctx.patientId ? "new prediction available" : null;
    },
  },
  {
    key: "escalate_overdue_followup",
    name: "Escalate overdue follow-up",
    description:
      "Moves a patient with an overdue follow-up into urgent review if they are still in a soft workflow state, and notifies the assignee.",
    trigger: "follow_up_overdue",
    actions: [
      { kind: "escalate_status", to: "urgent_review", onlySoft: true },
      { kind: "notify", priority: "high", channel: "assignee" },
    ],
    evaluate(ctx) {
      const daysOverdue = ctx.payload.daysOverdue as number | undefined;
      if (daysOverdue == null || daysOverdue < 2) return null;
      return `follow-up overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`;
    },
  },
  {
    key: "alert_dead_letter",
    name: "Alert on prediction dead-letter",
    description:
      "Notifies admins when the queue exhausts retries for a prediction job — usually a provider configuration issue worth a human look.",
    trigger: "prediction_dead_letter",
    actions: [{ kind: "notify", priority: "high", channel: "admins" }],
    evaluate() {
      return "prediction job exhausted retries";
    },
  },
  {
    key: "critical_stale_review",
    name: "Critical patient missing review",
    description:
      "Flags critical patients that have not been reviewed in over 24 hours and recommends clinician review.",
    trigger: "critical_unreviewed",
    actions: [
      { kind: "recommend_review" },
      { kind: "notify", priority: "high", channel: "assignee" },
    ],
    evaluate(ctx) {
      const hours = ctx.payload.hoursUnreviewed as number | undefined;
      if (hours == null || hours < 24) return null;
      return `critical patient unreviewed for ${Math.round(hours)}h`;
    },
  },
  {
    key: "biomarker_anomaly_notify",
    name: "Biomarker anomaly notification",
    description:
      "Notifies the assigned clinician when an anomalous biomarker spike is detected against the patient's recent baseline.",
    trigger: "biomarker_anomaly",
    actions: [{ kind: "notify", priority: "high", channel: "assignee" }],
    evaluate(ctx) {
      const label = ctx.payload.label as string | undefined;
      const z = ctx.payload.z as number | undefined;
      if (!label || z == null) return null;
      return `${label} spiked (z=${z.toFixed(2)}) above the patient's baseline`;
    },
  },
];

export const RULE_INDEX: Record<string, AutomationRule> = Object.fromEntries(
  BUILTIN_RULES.map((r) => [r.key, r]),
);
