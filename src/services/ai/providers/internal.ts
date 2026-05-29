import type { RiskLevel } from "@prisma/client";
import type { AIProvider, AIRequest } from "./types";
import {
  AIError,
  type AIOutput,
  type DigestOutput,
  type FollowUpBriefOutput,
  type HandoffOutput,
  type PatientSummaryOutput,
} from "../types";

// the internal provider is deterministic, template-driven, and works
// off the assembled context. it is not an LLM — it composes structured
// outputs from the memory layer. external providers may improve fluency
// but the contract and confidence floor stay identical.

type PatientCtx = {
  patient: { fullName: string; sex: string | null; ageYears: number | null };
  latest?: {
    riskLevel: RiskLevel;
    condition: string;
    confidence: number;
    observations: { label: string; status: string; hint: string }[];
    recommendations: string[];
  };
  trajectory: {
    direction: "improving" | "stable" | "worsening" | "volatile" | "unknown";
    delta: number;
    sampleCount: number;
    spanDays: number;
  };
  recurringFlags: { label: string; occurrences: number }[];
  workflow: {
    status: string;
    followUpDueInDays: number | null;
    daysSinceReview: number | null;
    assignedTo: string | null;
  };
  noteCount: number;
};

function buildPatientSummary(ctx: PatientCtx): PatientSummaryOutput {
  const { patient, latest, trajectory, recurringFlags, workflow } = ctx;
  const subject = subjectFor(patient);
  const overviewSegments: string[] = [];

  if (latest) {
    overviewSegments.push(
      `${subject} sits at ${describeRisk(latest.riskLevel)} risk with the model leaning toward ${latest.condition}.`,
    );
  } else {
    overviewSegments.push(
      `No prediction has been run for ${subject} yet — biomarker capture or AI run is pending.`,
    );
  }

  if (trajectory.sampleCount >= 2) {
    overviewSegments.push(
      `Across ${trajectory.sampleCount} assessments over the last ${trajectory.spanDays} day${trajectory.spanDays === 1 ? "" : "s"}, the trend reads ${trajectory.direction}.`,
    );
  }

  if (workflow.followUpDueInDays !== null) {
    overviewSegments.push(
      workflow.followUpDueInDays < 0
        ? `Follow-up is overdue by ${Math.abs(workflow.followUpDueInDays)} day${Math.abs(workflow.followUpDueInDays) === 1 ? "" : "s"}.`
        : `Next follow-up sits in ${workflow.followUpDueInDays} day${workflow.followUpDueInDays === 1 ? "" : "s"}.`,
    );
  }

  const trajectoryLine = describeTrajectory(ctx);

  const observations: PatientSummaryOutput["observations"] = [];
  if (latest) {
    for (const obs of latest.observations.slice(0, 4)) {
      if (obs.status === "ok") continue;
      observations.push({
        label: obs.label,
        detail: obs.hint,
        severity: mapSeverity(obs.status),
      });
    }
  }
  for (const f of recurringFlags) {
    if (f.occurrences < 2) continue;
    observations.push({
      label: `Recurring ${f.label.toLowerCase()}`,
      detail: `${f.occurrences} consecutive assessments above the watch band.`,
      severity: "concern",
    });
  }
  if (workflow.daysSinceReview !== null && workflow.daysSinceReview > 14) {
    observations.push({
      label: "Stale clinician review",
      detail: `Last reviewed ${workflow.daysSinceReview} days ago.`,
      severity: workflow.daysSinceReview > 30 ? "concern" : "watch",
    });
  }

  const recommendedActions: PatientSummaryOutput["recommendedActions"] = [];
  if (latest?.riskLevel === "critical") {
    recommendedActions.push({
      label: "Schedule clinician review within 24h",
      rationale: "Critical-tier outcome on the latest model run.",
      weight: 1,
    });
  } else if (latest?.riskLevel === "elevated") {
    recommendedActions.push({
      label: "Clinician follow-up this week",
      rationale: "Elevated outcome with multiple biomarkers out of range.",
      weight: 0.8,
    });
  }
  if (trajectory.direction === "worsening") {
    recommendedActions.push({
      label: "Investigate recent biomarker drift",
      rationale: `Risk score has trended up across ${trajectory.sampleCount} assessments.`,
      weight: 0.7,
    });
  }
  if (workflow.followUpDueInDays !== null && workflow.followUpDueInDays < 0) {
    recommendedActions.push({
      label: "Resolve overdue follow-up",
      rationale: `Outstanding for ${Math.abs(workflow.followUpDueInDays)} day(s).`,
      weight: 0.6,
    });
  }
  if (ctx.noteCount === 0) {
    recommendedActions.push({
      label: "Add a clinician note to capture context",
      rationale: "No notes recorded — handoff context is thin.",
      weight: 0.3,
    });
  }

  // confidence is deterministic: floor + per-signal boost
  const confidence = clamp(
    0.55 +
      (latest ? 0.15 : 0) +
      Math.min(0.15, trajectory.sampleCount * 0.03) +
      Math.min(0.1, observations.length * 0.025),
    0,
    0.92,
  );

  return {
    overview: overviewSegments.join(" "),
    trajectory: trajectoryLine,
    observations,
    recommendedActions: recommendedActions.slice(0, 4),
    confidence,
  };
}

function describeTrajectory(ctx: PatientCtx): string {
  const t = ctx.trajectory;
  if (t.sampleCount < 2) return "Not enough assessments yet to read a trajectory.";
  const dir =
    t.direction === "improving"
      ? "improving"
      : t.direction === "worsening"
        ? "worsening"
        : t.direction === "volatile"
          ? "volatile"
          : "stable";
  const magnitude = Math.abs(t.delta);
  if (dir === "stable") return "Risk profile has been stable across recent assessments.";
  if (dir === "volatile") return "Risk has fluctuated across recent assessments — pattern is unstable.";
  return `Risk is ${dir}; the model output has shifted by ${magnitude.toFixed(2)} points across the last ${t.sampleCount} assessments.`;
}

function mapSeverity(status: string): "info" | "watch" | "concern" | "urgent" {
  if (status === "critical") return "urgent";
  if (status === "elevated") return "concern";
  if (status === "watch") return "watch";
  return "info";
}

function describeRisk(r: RiskLevel) {
  switch (r) {
    case "critical":
      return "critical";
    case "elevated":
      return "elevated";
    case "moderate":
      return "moderate";
    case "low":
      return "low";
  }
}

function subjectFor(p: { fullName: string; sex: string | null; ageYears: number | null }) {
  const age = p.ageYears != null ? `${p.ageYears}-year-old` : null;
  const sex = p.sex === "female" ? "female" : p.sex === "male" ? "male" : null;
  if (age && sex) return `${age} ${sex} patient`;
  if (age) return `${age} patient`;
  if (sex) return `${sex} patient`;
  return p.fullName.split(" ")[0] ?? "the patient";
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

type HandoffCtx = {
  user: { name: string };
  caseload: {
    urgent: { name: string; reason: string; risk: RiskLevel }[];
    followUp: { name: string; reason: string; risk: RiskLevel | null }[];
    awaitingReview: { name: string; risk: RiskLevel | null }[];
  };
};

function buildHandoff(ctx: HandoffCtx): HandoffOutput {
  const total =
    ctx.caseload.urgent.length + ctx.caseload.followUp.length + ctx.caseload.awaitingReview.length;
  const headline =
    total === 0
      ? "Caseload is clear — nothing flagged for handoff."
      : `${total} item${total === 1 ? "" : "s"} need attention next shift for ${ctx.user.name}.`;

  const highlights: string[] = [];
  for (const p of ctx.caseload.urgent.slice(0, 4)) {
    highlights.push(`${p.name} — ${p.reason}`);
  }
  for (const p of ctx.caseload.followUp.slice(0, 3)) {
    highlights.push(`${p.name} — ${p.reason}`);
  }

  const pendingDecisions: string[] = [];
  for (const p of ctx.caseload.awaitingReview.slice(0, 4)) {
    pendingDecisions.push(`Confirm next step for ${p.name}.`);
  }

  const riskFlag: HandoffOutput["riskFlag"] = ctx.caseload.urgent.length > 0 ? "critical" : "low";
  return {
    headline,
    highlights,
    pendingDecisions,
    riskFlag,
    confidence: 0.78,
  };
}

type DigestCtx = {
  unresolvedCritical: { name: string; daysFlagged: number }[];
  overdueFollowUps: { name: string; daysOverdue: number }[];
  predictionFailures: { name: string; reason: string }[];
};

function buildCriticalDigest(ctx: DigestCtx): DigestOutput {
  const total =
    ctx.unresolvedCritical.length + ctx.overdueFollowUps.length + ctx.predictionFailures.length;
  return {
    headline:
      total === 0
        ? "No unresolved critical cases."
        : `${total} unresolved item${total === 1 ? "" : "s"} across the operational layer.`,
    buckets: [
      {
        label: "Unresolved critical patients",
        items: ctx.unresolvedCritical.map(
          (p) => `${p.name} — flagged ${p.daysFlagged} day${p.daysFlagged === 1 ? "" : "s"} ago`,
        ),
      },
      {
        label: "Overdue follow-ups",
        items: ctx.overdueFollowUps.map(
          (p) => `${p.name} — overdue by ${p.daysOverdue} day${p.daysOverdue === 1 ? "" : "s"}`,
        ),
      },
      {
        label: "Recent prediction failures",
        items: ctx.predictionFailures.map((p) => `${p.name} — ${p.reason}`),
      },
    ].filter((b) => b.items.length > 0),
    confidence: 0.85,
  };
}

type FollowUpBriefCtx = {
  patients: { name: string; reason: string; risk: RiskLevel | null }[];
};

function buildFollowUpBrief(ctx: FollowUpBriefCtx): FollowUpBriefOutput {
  return {
    headline:
      ctx.patients.length === 0
        ? "No patients flagged for urgent review."
        : `${ctx.patients.length} patient${ctx.patients.length === 1 ? "" : "s"} need a clinician's eye now.`,
    patients: ctx.patients,
    confidence: 0.82,
  };
}

export const internalAIProvider: AIProvider = {
  name: "internal",
  model: "mira-orchestrator-v1",
  async complete(req: AIRequest): Promise<AIOutput> {
    switch (req.task) {
      case "patient_summary":
        return buildPatientSummary(req.context as PatientCtx);
      case "clinician_handoff":
        return buildHandoff(req.context as HandoffCtx);
      case "critical_digest":
        return buildCriticalDigest(req.context as DigestCtx);
      case "follow_up_brief":
        return buildFollowUpBrief(req.context as FollowUpBriefCtx);
      default:
        throw new AIError(`unknown task ${req.task}`, "internal", false);
    }
  },
};
