"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";
import type { PatientCreateInput } from "./schema";
import type { PatientListResponse, PatientRow } from "./types";

export type PatientFilters = {
  q?: string;
  risk?: "low" | "moderate" | "elevated" | "critical";
  page?: number;
  sort?: "createdAt" | "fullName" | "lastPredictedAt";
  order?: "asc" | "desc";
};

function buildQuery(f: PatientFilters) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.risk) p.set("risk", f.risk);
  if (f.page) p.set("page", String(f.page));
  if (f.sort) p.set("sort", f.sort);
  if (f.order) p.set("order", f.order);
  return p.toString();
}

export const patientsKey = (f: PatientFilters) => ["patients", f] as const;

export function usePatients(filters: PatientFilters, options?: Partial<UseQueryOptions<PatientListResponse>>) {
  return useQuery<PatientListResponse>({
    queryKey: patientsKey(filters),
    queryFn: () => fetcher<PatientListResponse>(`/api/patients?${buildQuery(filters)}`),
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PatientCreateInput) =>
      fetcher<PatientRow>(`/api/patients`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export function useArchivePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher<{ id: string }>(`/api/patients/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["patients"] });
      const snapshots = qc.getQueriesData<PatientListResponse>({ queryKey: ["patients"] });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData<PatientListResponse>(key, {
          ...data,
          rows: data.rows.filter((r) => r.id !== id),
          total: Math.max(0, data.total - 1),
        });
      }
      return { snapshots };
    },
    onError: (_e, _id, ctx) => {
      ctx?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useRunPrediction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patientId: string) =>
      fetcher<unknown>(`/api/patients/${patientId}/predict`, { method: "POST" }),
    onSuccess: (_, patientId) => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient", patientId] });
      qc.invalidateQueries({ queryKey: ["predictions", patientId] });
      qc.invalidateQueries({ queryKey: ["activity", patientId] });
    },
  });
}
