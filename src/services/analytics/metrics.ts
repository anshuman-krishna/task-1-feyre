// metric registry. names + units + display metadata for everything the
// warehouse captures. defining metrics in one place lets the UI render any
// snapshot without hardcoding labels in components.

export type MetricCategory =
  | "patients"
  | "predictions"
  | "workflow"
  | "automation"
  | "approvals"
  | "ai"
  | "notifications"
  | "anomalies";

export type MetricUnit = "count" | "ratio" | "ms" | "score";

export type MetricDef = {
  key: string;
  label: string;
  unit: MetricUnit;
  category: MetricCategory;
  description: string;
};

export const METRICS = {
  active_patients: {
    key: "active_patients",
    label: "Active patients",
    unit: "count",
    category: "patients",
    description: "Patients with no archival flag at snapshot time.",
  },
  urgent_patients: {
    key: "urgent_patients",
    label: "Urgent patients",
    unit: "count",
    category: "patients",
    description: "Patients in urgent_review workflow.",
  },
  critical_patients: {
    key: "critical_patients",
    label: "Critical-risk patients",
    unit: "count",
    category: "patients",
    description: "Patients with risk level critical.",
  },
  elevated_patients: {
    key: "elevated_patients",
    label: "Elevated-risk patients",
    unit: "count",
    category: "patients",
    description: "Patients with risk level elevated.",
  },
  followups_overdue: {
    key: "followups_overdue",
    label: "Follow-ups overdue",
    unit: "count",
    category: "workflow",
    description: "Patients with follow-up date in the past.",
  },
  unreviewed_critical: {
    key: "unreviewed_critical",
    label: "Critical, unreviewed",
    unit: "count",
    category: "workflow",
    description: "Critical-risk patients with no recent review.",
  },
  predictions_total: {
    key: "predictions_total",
    label: "Prediction volume",
    unit: "count",
    category: "predictions",
    description: "Predictions written in the snapshot window.",
  },
  prediction_failures: {
    key: "prediction_failures",
    label: "Prediction failures",
    unit: "count",
    category: "predictions",
    description: "Predictions completed with an error in the window.",
  },
  automation_fires: {
    key: "automation_fires",
    label: "Automation fires",
    unit: "count",
    category: "automation",
    description: "Automation rule firings in the window.",
  },
  approvals_pending: {
    key: "approvals_pending",
    label: "Pending approvals",
    unit: "count",
    category: "approvals",
    description: "Approvals awaiting decision at snapshot time.",
  },
  approvals_decided: {
    key: "approvals_decided",
    label: "Approvals decided",
    unit: "count",
    category: "approvals",
    description: "Approvals resolved (approved or rejected) in the window.",
  },
  ai_runs: {
    key: "ai_runs",
    label: "AI runs",
    unit: "count",
    category: "ai",
    description: "Orchestrator calls in the window.",
  },
  ai_avg_latency_ms: {
    key: "ai_avg_latency_ms",
    label: "AI average latency",
    unit: "ms",
    category: "ai",
    description: "Mean orchestrator call latency in the window.",
  },
  ai_avg_confidence: {
    key: "ai_avg_confidence",
    label: "AI average confidence",
    unit: "ratio",
    category: "ai",
    description: "Mean confidence across orchestrator outputs.",
  },
  notifications_total: {
    key: "notifications_total",
    label: "Notifications generated",
    unit: "count",
    category: "notifications",
    description: "Notifications written in the window.",
  },
  clinician_load_avg: {
    key: "clinician_load_avg",
    label: "Mean clinician caseload",
    unit: "count",
    category: "workflow",
    description: "Mean active patients per clinician.",
  },
  clinician_load_max: {
    key: "clinician_load_max",
    label: "Peak clinician caseload",
    unit: "count",
    category: "workflow",
    description: "Maximum active patients assigned to a single clinician.",
  },
  recurring_anomaly_patients: {
    key: "recurring_anomaly_patients",
    label: "Recurring-anomaly patients",
    unit: "count",
    category: "anomalies",
    description: "Patients with anomalies persisting across runs.",
  },
} as const satisfies Record<string, MetricDef>;

export type MetricKey = keyof typeof METRICS;

export function metricDef(key: string): MetricDef | undefined {
  return (METRICS as Record<string, MetricDef>)[key];
}

export function metricsByCategory() {
  const out: Record<MetricCategory, MetricDef[]> = {
    patients: [],
    predictions: [],
    workflow: [],
    automation: [],
    approvals: [],
    ai: [],
    notifications: [],
    anomalies: [],
  };
  for (const m of Object.values(METRICS) as MetricDef[]) out[m.category].push(m);
  return out;
}
