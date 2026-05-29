import type { RiskLevel } from "@prisma/client";

// shared types for the AI orchestration layer.
// these stay deliberately small — the layer is a thin contract
// around context-in, structured-output-out, with auditable metadata.

export type AITaskKind =
  | "patient_summary"
  | "clinician_handoff"
  | "critical_digest"
  | "follow_up_brief";

export type AIObservation = {
  label: string;
  detail: string;
  severity: "info" | "watch" | "concern" | "urgent";
};

export type AIRecommendedAction = {
  label: string;
  rationale: string;
  weight: number; // 0..1
};

export type PatientSummaryOutput = {
  overview: string;
  trajectory: string;
  observations: AIObservation[];
  recommendedActions: AIRecommendedAction[];
  confidence: number;
};

export type HandoffOutput = {
  headline: string;
  highlights: string[];
  pendingDecisions: string[];
  riskFlag: RiskLevel | "unknown";
  confidence: number;
};

export type DigestOutput = {
  headline: string;
  buckets: { label: string; items: string[] }[];
  confidence: number;
};

export type FollowUpBriefOutput = {
  headline: string;
  patients: { name: string; reason: string; risk: RiskLevel | null }[];
  confidence: number;
};

export type AIOutput =
  | PatientSummaryOutput
  | HandoffOutput
  | DigestOutput
  | FollowUpBriefOutput;

export type AIRunMeta = {
  provider: string;
  model?: string;
  latencyMs: number;
  degraded: boolean;
  reason?: string;
};

export class AIError extends Error {
  constructor(
    message: string,
    public provider: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "AIError";
  }
}
