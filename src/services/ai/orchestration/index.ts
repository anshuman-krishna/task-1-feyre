import type { Prisma } from "@prisma/client";
import { log } from "@/server/logger";
import { metrics } from "@/server/metrics";
import { recordAIRun } from "@/services/governance/lineage";
import { tenantOf } from "@/services/tenant";
import {
  getAIProvider,
  recordFailure,
  recordSuccess,
} from "../providers";
import { promptFor } from "../prompts";
import {
  AIError,
  type AIOutput,
  type AIRunMeta,
  type AITaskKind,
} from "../types";

type RunOpts = {
  providerName?: string;
  // single retry against the fallback if the primary fails
  allowFallback?: boolean;
  // lineage routing — every run records an AIRun row
  organizationId?: string;
  patientId?: string | null;
  actorId?: string | null;
  sourceVersion?: string | null;
};

export type AIRun<T extends AIOutput = AIOutput> = {
  output: T;
  meta: AIRunMeta;
  runId: string;
};

// the only entrypoint. callers build a context object, hand over a task,
// and get a structured output back with run metadata for audit.
// every call writes an AIRun row so lineage queries can answer
// "why did this artifact exist" without inspection of run-time logs.
export async function runAI<T extends AIOutput = AIOutput>(
  task: AITaskKind,
  context: Record<string, unknown>,
  opts: RunOpts = {},
): Promise<AIRun<T>> {
  const prompt = promptFor(task);
  const startedAt = Date.now();
  const organizationId = opts.organizationId ?? tenantOf(null);

  const first = getAIProvider(opts.providerName);
  let usedProvider = first.provider;
  let degraded = first.degraded;
  let reason: string | undefined = first.reason;
  let output: T;

  try {
    output = (await first.provider.complete({
      task,
      promptId: prompt.id,
      context,
    })) as T;
    recordSuccess(first.provider.name);
  } catch (err) {
    recordFailure(first.provider.name);
    metrics.inc("ai_runs_failed", { task, provider: first.provider.name });
    log.warn("ai.run.failed", {
      task,
      provider: first.provider.name,
      message: err instanceof Error ? err.message : String(err),
    });
    if (opts.allowFallback === false || first.provider.name === "internal") {
      throw err;
    }
    const floor = getAIProvider("internal");
    output = (await floor.provider.complete({
      task,
      promptId: prompt.id,
      context,
    })) as T;
    usedProvider = floor.provider;
    degraded = true;
    reason = err instanceof AIError ? err.message : "primary_failure";
  }

  const latencyMs = Date.now() - startedAt;
  metrics.inc("ai_runs_total", { task, provider: usedProvider.name });
  metrics.inc("orchestration_runs", { task, provider: usedProvider.name });
  metrics.observe("ai_latency_ms", latencyMs, { task });
  if (typeof (output as { confidence?: number }).confidence === "number") {
    metrics.observe("ai_confidence", (output as { confidence?: number }).confidence!, { task });
  }

  const run = await recordAIRun({
    organizationId,
    task,
    promptId: prompt.id,
    promptVersion: prompt.version,
    provider: usedProvider.name,
    model: usedProvider.model,
    latencyMs,
    degraded,
    reason: reason ?? null,
    confidence: (output as { confidence?: number }).confidence ?? null,
    patientId: opts.patientId ?? null,
    actorId: opts.actorId ?? null,
    sourceVersion: opts.sourceVersion ?? null,
    contextSummary: summariseContext(context) as unknown as Prisma.InputJsonValue,
    outputSummary: (summariseOutput(output) ?? {}) as unknown as Prisma.InputJsonValue,
  });

  const meta: AIRunMeta = {
    provider: usedProvider.name,
    model: usedProvider.model,
    latencyMs,
    degraded,
    reason,
  };
  log.info("ai.run.ok", {
    runId: run.id,
    task,
    provider: usedProvider.name,
    latencyMs,
    degraded,
  });
  return { output, meta, runId: run.id };
}

// keep AIRun.contextSummary small — pick stable fields, drop deep blobs
function summariseContext(ctx: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (v == null) continue;
    if (Array.isArray(v)) out[k] = { type: "array", length: v.length };
    else if (typeof v === "object") {
      const shape = Object.keys(v as object).slice(0, 12);
      out[k] = { type: "object", keys: shape };
    } else {
      out[k] = v;
    }
  }
  return out;
}

function summariseOutput(out: unknown) {
  if (out == null || typeof out !== "object") return null;
  const o = out as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  for (const k of ["headline", "overview", "trajectory", "confidence", "riskFlag"]) {
    if (o[k] != null) summary[k] = o[k];
  }
  if (Array.isArray(o.observations)) summary.observations = o.observations.length;
  if (Array.isArray(o.recommendedActions)) summary.recommendedActions = o.recommendedActions.length;
  if (Array.isArray(o.highlights)) summary.highlights = o.highlights.length;
  if (Array.isArray(o.buckets)) summary.buckets = o.buckets.length;
  if (Array.isArray(o.patients)) summary.patients = o.patients.length;
  return summary;
}

export { promptFor };
