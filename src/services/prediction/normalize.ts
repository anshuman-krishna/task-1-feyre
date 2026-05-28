import type { PredictionResult, BiomarkerObservation } from "./types";
import type { RiskLevel } from "@prisma/client";

const RISK_ORDER: RiskLevel[] = ["low", "moderate", "elevated", "critical"];

export function clampConfidence(c: number) {
  if (!Number.isFinite(c)) return 0.5;
  return Math.max(0, Math.min(1, c));
}

export function clampRisk(r: unknown): RiskLevel {
  if (typeof r === "string" && (RISK_ORDER as string[]).includes(r)) return r as RiskLevel;
  return "low";
}

// guarantees the canonical shape regardless of provider eccentricities
export function normalize(raw: Partial<PredictionResult>): PredictionResult {
  return {
    riskLevel: clampRisk(raw.riskLevel),
    condition: (raw.condition ?? "no significant indicators").toString().slice(0, 240),
    confidence: clampConfidence(Number(raw.confidence ?? 0.5)),
    summary: (raw.summary ?? "AI-generated observation.").toString().slice(0, 600),
    recommendations: Array.isArray(raw.recommendations)
      ? raw.recommendations.filter((s): s is string => typeof s === "string").slice(0, 6)
      : [],
    observations: Array.isArray(raw.observations)
      ? (raw.observations as BiomarkerObservation[]).slice(0, 8)
      : [],
  };
}

export function compareRisk(a: RiskLevel, b: RiskLevel) {
  return RISK_ORDER.indexOf(a) - RISK_ORDER.indexOf(b);
}
