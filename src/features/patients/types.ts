import type { RiskLevel, WorkflowStatus } from "@prisma/client";

export type AssignedUser = { id: string; name: string; avatarHue: number };

export type PatientRow = {
  id: string;
  fullName: string;
  email: string;
  dob: string;
  sex: "male" | "female" | "other" | null;
  glucose: number | null;
  haemoglobin: number | null;
  cholesterol: number | null;
  systolic: number | null;
  diastolic: number | null;
  bmi: number | null;
  riskLevel: RiskLevel | null;
  predictionConfidence: number | null;
  aiPrediction: string | null;
  lastPredictedAt: string | null;
  status: WorkflowStatus;
  assignedToId: string | null;
  assignedTo: AssignedUser | null;
  followUpAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PatientListResponse = {
  rows: PatientRow[];
  total: number;
  page: number;
  pageSize: number;
};
