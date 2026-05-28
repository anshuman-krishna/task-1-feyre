import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { logAudit, type Actor } from "@/services/audit";
import { log } from "@/server/logger";
import { metrics } from "@/server/metrics";
import { ageFromDob } from "@/lib/format";
import { getProvider } from "./providers";
import { normalize } from "./normalize";
import { PredictionError, type Biomarkers } from "./types";

export * from "./types";

export function hasBiomarkers(b: Biomarkers) {
  return (
    b.glucose != null ||
    b.haemoglobin != null ||
    b.cholesterol != null ||
    b.systolic != null ||
    b.diastolic != null ||
    b.bmi != null
  );
}

type ExecuteOpts = {
  providerName?: string;
  actor?: Actor;
};

// run a prediction for a patient. always writes a prediction_log + audit row.
// on failure, returns null but still records the attempt with provider/latency/error.
export async function executePrediction(patientId: string, opts: ExecuteOpts = {}) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return null;
  if (!hasBiomarkers(patient)) return null;

  const provider = getProvider(opts.providerName);
  const inputSnapshot: Biomarkers = {
    glucose: patient.glucose,
    haemoglobin: patient.haemoglobin,
    cholesterol: patient.cholesterol,
    systolic: patient.systolic,
    diastolic: patient.diastolic,
    bmi: patient.bmi,
  };

  const requestPayload = {
    ...inputSnapshot,
    age: ageFromDob(patient.dob),
    sex: patient.sex,
  };

  const startedAt = Date.now();
  try {
    const raw = await provider.predict(requestPayload);
    const result = normalize(raw);
    const latencyMs = Date.now() - startedAt;

    const [logRow] = await prisma.$transaction([
      prisma.predictionLog.create({
        data: {
          patientId,
          provider: provider.name,
          model: provider.model,
          riskLevel: result.riskLevel,
          condition: result.condition,
          confidence: result.confidence,
          summary: result.summary,
          recommendations: result.recommendations as unknown as Prisma.InputJsonValue,
          observations: result.observations as unknown as Prisma.InputJsonValue,
          contributions: result.contributions as unknown as Prisma.InputJsonValue,
          inputSnapshot: inputSnapshot as unknown as Prisma.InputJsonValue,
          requestPayload: requestPayload as unknown as Prisma.InputJsonValue,
          responsePayload: result as unknown as Prisma.InputJsonValue,
          latencyMs,
        },
      }),
      prisma.patient.update({
        where: { id: patientId },
        data: {
          riskLevel: result.riskLevel,
          predictionConfidence: result.confidence,
          aiPrediction: result.condition,
          lastPredictedAt: new Date(),
        },
      }),
    ]);

    metrics.inc("predictions_total", { provider: provider.name, risk: result.riskLevel });
    metrics.observe("prediction_latency_ms", latencyMs, { provider: provider.name });
    log.info("prediction.ok", {
      patientId,
      provider: provider.name,
      risk: result.riskLevel,
      confidence: result.confidence,
      latencyMs,
    });

    await logAudit({
      action: "predict",
      entityType: "patient",
      entityId: patientId,
      patientId,
      actor: opts.actor,
      metadata: { provider: provider.name, riskLevel: result.riskLevel, latencyMs },
    });

    return { result, log: logRow };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : "unknown provider error";

    metrics.inc("predictions_failed", { provider: provider.name });
    log.error("prediction.fail", { patientId, provider: provider.name, message, latencyMs });

    try {
      await prisma.predictionLog.create({
        data: {
          patientId,
          provider: provider.name,
          model: provider.model,
          riskLevel: patient.riskLevel ?? "low",
          condition: "prediction failed",
          confidence: 0,
          summary: message,
          recommendations: [] as unknown as Prisma.InputJsonValue,
          observations: [] as unknown as Prisma.InputJsonValue,
          contributions: [] as unknown as Prisma.InputJsonValue,
          inputSnapshot: inputSnapshot as unknown as Prisma.InputJsonValue,
          requestPayload: requestPayload as unknown as Prisma.InputJsonValue,
          responsePayload: { error: message } as unknown as Prisma.InputJsonValue,
          latencyMs,
          error: message,
        },
      });
    } catch {
      // swallow
    }

    await logAudit({
      action: "predict_fail",
      entityType: "patient",
      entityId: patientId,
      patientId,
      actor: opts.actor,
      metadata: {
        provider: provider.name,
        message,
        retryable: err instanceof PredictionError ? err.retryable : false,
      },
    });

    return null;
  }
}

export async function getPredictionHistory(patientId: string, limit = 20) {
  return prisma.predictionLog.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
