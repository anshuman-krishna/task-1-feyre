import type { RiskLevel } from "@prisma/client";

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
  createdAt: string;
  updatedAt: string;
};

export type PatientListResponse = {
  rows: PatientRow[];
  total: number;
  page: number;
  pageSize: number;
};
