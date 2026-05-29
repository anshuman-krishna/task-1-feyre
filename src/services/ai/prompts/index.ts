// prompt composition layer. these aren't free-text prompts — the system
// emits structured context envelopes that providers can serialise as they
// see fit (the internal provider walks them directly; an LLM provider
// would translate them into a system/user message pair).
//
// keeping prompts as structured envelopes is what lets us swap providers
// without writing brittle string templates per-task.

import type { AITaskKind } from "../types";

export type PromptDescriptor = {
  id: string;
  task: AITaskKind;
  version: string;
  // human-readable description used for telemetry + audit
  purpose: string;
};

export const PROMPTS: Record<AITaskKind, PromptDescriptor> = {
  patient_summary: {
    id: "patient_summary.v1",
    task: "patient_summary",
    version: "1",
    purpose: "produce a clinician-readable summary combining biomarkers, predictions, and workflow",
  },
  clinician_handoff: {
    id: "clinician_handoff.v1",
    task: "clinician_handoff",
    version: "1",
    purpose: "summarise the caseload a clinician should hand off at shift change",
  },
  critical_digest: {
    id: "critical_digest.v1",
    task: "critical_digest",
    version: "1",
    purpose: "summarise unresolved critical patients and operational backlog",
  },
  follow_up_brief: {
    id: "follow_up_brief.v1",
    task: "follow_up_brief",
    version: "1",
    purpose: "list patients needing urgent review with one-line reasons",
  },
};

export function promptFor(task: AITaskKind) {
  return PROMPTS[task];
}
