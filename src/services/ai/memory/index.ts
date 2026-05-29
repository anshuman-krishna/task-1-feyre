import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { ageFromDob } from "@/lib/format";
import {
  biomarkerSpikes,
  recurringObservations,
  trajectoryFromPredictions,
  type BiomarkerSpike,
  type RecurringFlag,
  type Trajectory,
} from "./trajectory";

// patient intelligence memory — single entrypoint for assembling the
// longitudinal context the AI orchestrator and automation engine reason over.

export type PatientMemory = {
  patient: {
    id: string;
    fullName: string;
    sex: string | null;
    ageYears: number | null;
    status: string;
    assignedTo: string | null;
  };
  latest: {
    riskLevel: "low" | "moderate" | "elevated" | "critical";
    condition: string;
    confidence: number;
    summary: string;
    observations: { label: string; status: string; hint: string }[];
    recommendations: string[];
    at: Date;
  } | null;
  trajectory: Trajectory;
  recurringFlags: RecurringFlag[];
  spikes: BiomarkerSpike[];
  workflow: {
    status: string;
    followUpDueInDays: number | null;
    daysSinceReview: number | null;
    assignedTo: string | null;
  };
  noteCount: number;
  // a fingerprint of the inputs — flips when something material changes.
  // used to detect stale summaries without diffing the full record.
  sourceVersion: string;
};

const BIOMARKER_LABELS = [
  "Fasting glucose",
  "Total cholesterol",
  "Blood pressure",
  "Haemoglobin",
  "BMI",
];

export async function loadPatientMemory(patientId: string): Promise<PatientMemory | null> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { assignedTo: { select: { name: true } } },
  });
  if (!patient) return null;

  const history = await prisma.predictionLog.findMany({
    where: { patientId, error: null },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  const trajectory = trajectoryFromPredictions(history);
  const recurringFlags = recurringObservations(
    history.map((h) => ({ observations: parseObs(h.observations) })),
  );

  // collect biomarker series for spike detection
  const series = BIOMARKER_LABELS.map((label) => ({
    label,
    values: history.map((h) => {
      const obs = parseObs(h.observations).find((o) => o.label === label);
      return { value: obs?.value ?? null, at: h.createdAt };
    }),
  }));
  const spikes = biomarkerSpikes(series);

  const noteCount = await prisma.note.count({ where: { patientId } });

  const latest = history[history.length - 1] ?? null;

  const followUpDueInDays =
    patient.followUpAt == null
      ? null
      : Math.round((patient.followUpAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  const daysSinceReview =
    patient.reviewedAt == null
      ? null
      : Math.round((Date.now() - patient.reviewedAt.getTime()) / (24 * 60 * 60 * 1000));

  return {
    patient: {
      id: patient.id,
      fullName: patient.fullName,
      sex: patient.sex,
      ageYears: ageFromDob(patient.dob),
      status: patient.status,
      assignedTo: patient.assignedTo?.name ?? null,
    },
    latest: latest
      ? {
          riskLevel: latest.riskLevel,
          condition: latest.condition,
          confidence: latest.confidence,
          summary: latest.summary,
          observations: parseObs(latest.observations),
          recommendations: parseStringArray(latest.recommendations),
          at: latest.createdAt,
        }
      : null,
    trajectory,
    recurringFlags,
    spikes,
    workflow: {
      status: patient.status,
      followUpDueInDays,
      daysSinceReview,
      assignedTo: patient.assignedTo?.name ?? null,
    },
    noteCount,
    sourceVersion: fingerprint([
      latest?.id ?? "none",
      patient.status,
      String(patient.followUpAt?.getTime() ?? 0),
      String(patient.reviewedAt?.getTime() ?? 0),
      String(noteCount),
    ]),
  };
}

function parseObs(v: Prisma.JsonValue) {
  if (!Array.isArray(v)) return [];
  const out: { label: string; status: string; hint: string; value: number | null }[] = [];
  for (const raw of v) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
    const o = raw as Record<string, unknown>;
    out.push({
      label: String(o.label ?? ""),
      status: String(o.status ?? "ok"),
      hint: String(o.hint ?? ""),
      value: typeof o.value === "number" ? o.value : null,
    });
  }
  return out;
}

function parseStringArray(v: Prisma.JsonValue) {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function fingerprint(parts: string[]) {
  // tiny non-crypto hash — enough to detect input changes
  let h = 0;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export { trajectoryFromPredictions, recurringObservations, biomarkerSpikes };
