import type { RiskLevel } from "@prisma/client";
import type {
  BiomarkerObservation,
  PredictionInput,
  PredictionProviderImpl,
  PredictionResult,
} from "../types";

// internal heuristic provider.
// deterministic, transparent, calibrated against rough clinical ranges.
// this is not a diagnostic tool — it surfaces signals worth a clinician's eye.

type Finding = { obs: BiomarkerObservation; condition?: string; score: number };

const checkGlucose = (g?: number | null): Finding | null => {
  if (g == null) return null;
  if (g >= 200)
    return {
      obs: { label: "Fasting glucose", value: g, status: "critical", hint: "well above upper normal range" },
      condition: "metabolic imbalance",
      score: 3,
    };
  if (g >= 140)
    return {
      obs: { label: "Fasting glucose", value: g, status: "elevated", hint: "elevated; review with fasting test" },
      condition: "possible diabetes risk",
      score: 2,
    };
  if (g >= 110)
    return {
      obs: { label: "Fasting glucose", value: g, status: "watch", hint: "borderline impaired range" },
      condition: "early glycemic drift",
      score: 1,
    };
  return { obs: { label: "Fasting glucose", value: g, status: "ok", hint: "within normal range" }, score: 0 };
};

const checkCholesterol = (c?: number | null): Finding | null => {
  if (c == null) return null;
  if (c >= 280)
    return {
      obs: { label: "Total cholesterol", value: c, status: "critical", hint: "very high; cardiac follow-up" },
      condition: "cardiovascular concern",
      score: 3,
    };
  if (c >= 240)
    return {
      obs: { label: "Total cholesterol", value: c, status: "elevated", hint: "above the high-risk threshold" },
      condition: "cardiovascular risk pattern",
      score: 2,
    };
  if (c >= 200)
    return {
      obs: { label: "Total cholesterol", value: c, status: "watch", hint: "borderline; lifestyle review" },
      score: 1,
    };
  return { obs: { label: "Total cholesterol", value: c, status: "ok", hint: "within range" }, score: 0 };
};

const checkBp = (sys?: number | null, dia?: number | null): Finding | null => {
  if (sys == null && dia == null) return null;
  const s = sys ?? 0;
  const d = dia ?? 0;
  const label = "Blood pressure";
  if (s >= 180 || d >= 120)
    return {
      obs: { label, value: s, status: "critical", hint: `hypertensive crisis range (${s}/${d})` },
      condition: "cardiovascular concern",
      score: 3,
    };
  if (s >= 140 || d >= 90)
    return {
      obs: { label, value: s, status: "elevated", hint: `stage 2 hypertension range (${s}/${d})` },
      condition: "cardiovascular risk pattern",
      score: 2,
    };
  if (s >= 130 || d >= 80)
    return {
      obs: { label, value: s, status: "watch", hint: `elevated baseline (${s}/${d})` },
      score: 1,
    };
  return { obs: { label, value: s, status: "ok", hint: `normal range (${s}/${d})` }, score: 0 };
};

const checkHaemoglobin = (h?: number | null, sex?: string | null): Finding | null => {
  if (h == null) return null;
  const lower = sex === "female" ? 12 : 13.5;
  if (h < lower - 2)
    return {
      obs: { label: "Haemoglobin", value: h, status: "critical", hint: "significantly low — anemia indicators" },
      condition: "anemia indicators",
      score: 2,
    };
  if (h < lower)
    return {
      obs: { label: "Haemoglobin", value: h, status: "watch", hint: "below reference range" },
      condition: "mild anemia indicators",
      score: 1,
    };
  return { obs: { label: "Haemoglobin", value: h, status: "ok", hint: "within reference range" }, score: 0 };
};

const checkBmi = (b?: number | null): Finding | null => {
  if (b == null) return null;
  if (b >= 35)
    return {
      obs: { label: "BMI", value: b, status: "elevated", hint: "obesity class II or above" },
      score: 2,
    };
  if (b >= 30)
    return { obs: { label: "BMI", value: b, status: "watch", hint: "obesity range" }, score: 1 };
  if (b < 18.5)
    return { obs: { label: "BMI", value: b, status: "watch", hint: "below normal range" }, score: 1 };
  return { obs: { label: "BMI", value: b, status: "ok", hint: "within healthy range" }, score: 0 };
};

const RISK_BANDS: { min: number; level: RiskLevel }[] = [
  { min: 7, level: "critical" },
  { min: 4, level: "elevated" },
  { min: 2, level: "moderate" },
  { min: 0, level: "low" },
];

function deriveCondition(findings: Finding[]): string {
  const ranked = findings.filter((f) => f.condition).sort((a, b) => b.score - a.score);
  return ranked[0]?.condition ?? "no significant indicators";
}

function deriveRisk(totalScore: number, findings: Finding[]): RiskLevel {
  const hasCritical = findings.some((f) => f.obs.status === "critical");
  if (hasCritical) return "critical";
  return RISK_BANDS.find((b) => totalScore >= b.min)?.level ?? "low";
}

function deriveSummary(findings: Finding[], risk: RiskLevel, condition: string) {
  const notable = findings.filter((f) => f.obs.status !== "ok");
  if (notable.length === 0) return "Biomarkers fall within expected reference ranges across the panel.";
  const phrases = notable.slice(0, 3).map((f) => f.obs.hint);
  const lead =
    risk === "critical"
      ? "Multiple indicators sit in a critical range."
      : risk === "elevated"
        ? "Several biomarkers show elevated patterns."
        : risk === "moderate"
          ? "A subset of biomarkers warrant closer review."
          : "Borderline values worth monitoring.";
  return `${lead} ${phrases.join("; ")}. Pattern consistent with ${condition}.`;
}

function deriveRecommendations(findings: Finding[], risk: RiskLevel): string[] {
  const recs = new Set<string>();
  for (const f of findings) {
    if (f.obs.status === "ok") continue;
    switch (f.obs.label) {
      case "Fasting glucose":
        recs.add("repeat fasting glucose test");
        if (f.score >= 2) recs.add("HbA1c panel within 30 days");
        break;
      case "Total cholesterol":
        recs.add("lipid panel with LDL/HDL breakdown");
        if (f.score >= 2) recs.add("cardiology referral");
        break;
      case "Blood pressure":
        recs.add("ambulatory BP monitoring over 48 hours");
        if (f.score >= 3) recs.add("urgent clinical evaluation");
        break;
      case "Haemoglobin":
        recs.add("CBC with iron studies");
        break;
      case "BMI":
        recs.add("metabolic risk counselling");
        break;
    }
  }
  if (risk === "critical") recs.add("schedule clinician review within 24 hours");
  else if (risk === "elevated") recs.add("clinician follow-up within 7 days");
  return Array.from(recs).slice(0, 5);
}

function deriveConfidence(provided: number): number {
  // confidence grows with coverage. 6 biomarkers → ~0.9 ceiling
  return Math.min(0.95, 0.55 + provided * 0.06);
}

export const internalProvider: PredictionProviderImpl = {
  name: "internal",
  model: "mira-heuristic-v1",
  async predict(input: PredictionInput): Promise<PredictionResult> {
    const findings: Finding[] = [
      checkGlucose(input.glucose),
      checkCholesterol(input.cholesterol),
      checkBp(input.systolic, input.diastolic),
      checkHaemoglobin(input.haemoglobin, input.sex),
      checkBmi(input.bmi),
    ].filter((f): f is Finding => f !== null);

    const provided = [
      input.glucose,
      input.haemoglobin,
      input.cholesterol,
      input.systolic ?? input.diastolic,
      input.bmi,
    ].filter((v) => v != null).length;

    const totalScore = findings.reduce((s, f) => s + f.score, 0);
    const risk = deriveRisk(totalScore, findings);
    const condition = deriveCondition(findings);
    const confidence = deriveConfidence(provided);

    return {
      riskLevel: risk,
      condition,
      confidence,
      summary: deriveSummary(findings, risk, condition),
      recommendations: deriveRecommendations(findings, risk),
      observations: findings.map((f) => f.obs),
    };
  },
};
