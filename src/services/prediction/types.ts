import type { RiskLevel } from "@prisma/client";

export type Biomarkers = {
  glucose?: number | null;
  haemoglobin?: number | null;
  cholesterol?: number | null;
  systolic?: number | null;
  diastolic?: number | null;
  bmi?: number | null;
};

export type PredictionInput = Biomarkers & {
  age?: number;
  sex?: string | null;
};

export type BiomarkerObservation = {
  label: string;
  value: number | null;
  status: "ok" | "watch" | "elevated" | "critical";
  hint: string;
};

export type Contribution = {
  label: string;
  weight: number; // 0..1, normalised share of total risk score
  direction: "up" | "neutral";
};

export type PredictionResult = {
  riskLevel: RiskLevel;
  condition: string;
  confidence: number;
  summary: string;
  recommendations: string[];
  observations: BiomarkerObservation[];
  contributions: Contribution[];
};

export interface PredictionProviderImpl {
  name: "mock" | "internal" | "openai" | "groq" | "huggingface";
  model?: string;
  predict(input: PredictionInput): Promise<PredictionResult>;
}

export class PredictionError extends Error {
  constructor(
    message: string,
    public provider: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "PredictionError";
  }
}
