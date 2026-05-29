"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";

export type SummaryObservation = {
  label: string;
  detail: string;
  severity: "info" | "watch" | "concern" | "urgent";
};

export type SummaryAction = {
  label: string;
  rationale: string;
  weight: number;
};

export type PatientSummary = {
  id: string;
  patientId: string;
  overview: string;
  trajectory: string;
  observations: SummaryObservation[];
  recommendedActions: SummaryAction[];
  confidence: number;
  generatedBy: string;
  model: string | null;
  sourceVersion: string;
  revision: number;
  promptVersion: string;
  promptId: string;
  approvalState: "draft" | "pending_review" | "published";
  aiRunId: string | null;
  createdAt: string;
  updatedAt: string;
  stale: boolean;
  lowConfidence: boolean;
} | null;

export const summaryKey = (patientId: string) => ["summary", patientId] as const;

export function usePatientSummary(patientId: string) {
  return useQuery<PatientSummary>({
    queryKey: summaryKey(patientId),
    queryFn: () => fetcher<PatientSummary>(`/api/patients/${patientId}/summary`),
  });
}

export function useRefreshSummary(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetcher<PatientSummary>(`/api/patients/${patientId}/summary`, { method: "POST" }),
    onSuccess: (data) => {
      qc.setQueryData(summaryKey(patientId), data);
    },
  });
}

export function usePublishSummary(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetcher<PatientSummary>(`/api/patients/${patientId}/summary/publish`, { method: "POST" }),
    onSuccess: (data) => {
      qc.setQueryData(summaryKey(patientId), data);
    },
  });
}

export type LineageBundle = {
  runs: {
    id: string;
    task: string;
    promptId: string;
    promptVersion: string;
    provider: string;
    model: string | null;
    latencyMs: number;
    degraded: boolean;
    confidence: number | null;
    createdAt: string;
  }[];
  revisions: {
    id: string;
    revision: number;
    generatedBy: string;
    confidence: number;
    approvalState: string;
    promptVersion: string;
    createdAt: string;
  }[];
  events: {
    id: string;
    ruleName: string;
    ruleKey: string;
    trigger: string;
    reason: string;
    createdAt: string;
  }[];
};

export function usePatientLineage(patientId: string) {
  return useQuery<LineageBundle>({
    queryKey: ["lineage", patientId],
    queryFn: () => fetcher<LineageBundle>(`/api/admin/lineage/${patientId}`),
  });
}

export type AnomalySignal = {
  kind: "biomarker_spike" | "recurring_flag" | "workflow_gap";
  label: string;
  detail: string;
  severity: "watch" | "concern" | "urgent";
};

export function useAnomalies(patientId: string) {
  return useQuery<AnomalySignal[]>({
    queryKey: ["anomalies", patientId],
    queryFn: () => fetcher<AnomalySignal[]>(`/api/patients/${patientId}/anomalies`),
  });
}

export type AssignmentSuggestion = {
  userId: string;
  name: string;
  role: string;
  avatarHue: number;
  load: {
    active: number;
    critical: number;
    overdueFollowUps: number;
    recentActivity: number;
  };
  score: number;
  reason: string;
};

export function useAssignmentSuggestions(patientId: string, enabled: boolean) {
  return useQuery<AssignmentSuggestion[]>({
    queryKey: ["assignment", patientId],
    queryFn: () =>
      fetcher<AssignmentSuggestion[]>(`/api/patients/${patientId}/assign/suggest`),
    enabled,
  });
}

export type CopilotAction = "urgent_review" | "unresolved_criticals" | "clinician_handoff";

export type CopilotMeta = {
  provider: string;
  model?: string | null;
  latencyMs: number;
  degraded: boolean;
  reason?: string;
};

export type CopilotResponse = {
  action: CopilotAction;
  output: unknown;
  meta: CopilotMeta;
};

export function useRunCopilot() {
  return useMutation({
    mutationFn: (action: CopilotAction) =>
      fetcher<CopilotResponse>("/api/copilot", {
        method: "POST",
        body: JSON.stringify({ action }),
      }),
  });
}
