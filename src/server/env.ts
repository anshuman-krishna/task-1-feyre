import { z } from "zod";

// env validation runs once at module load. failures throw with a readable
// summary so the operator sees what to fix; in production this aborts boot.
// in development we still throw so dev users see the same surface.

const Schema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 chars"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  AI_PROVIDER: z.string().optional(),
  AI_ORCHESTRATOR: z.string().optional(),
  MIRA_DISABLE_WORKER: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

export type Env = z.infer<typeof Schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const result = Schema.safeParse(process.env);
  if (!result.success) {
    const lines = result.error.errors.map((e) => `- ${e.path.join(".")}: ${e.message}`);
    throw new Error(
      `Environment validation failed:\n${lines.join("\n")}\n\nSee .env.example for the expected shape.`,
    );
  }
  cached = result.data;
  return cached;
}

// startup diagnostics — emitted once when the worker boots. captures the
// shape of the environment without leaking secrets.
export function bootDiagnostics() {
  const e = env();
  return {
    node: process.version,
    nodeEnv: e.NODE_ENV ?? "development",
    logLevel: e.LOG_LEVEL,
    aiPredictionProvider: e.AI_PROVIDER ?? "internal",
    aiOrchestrationProvider: e.AI_ORCHESTRATOR ?? "internal",
    workerEnabled: e.MIRA_DISABLE_WORKER !== "1",
    dbHost: maskHost(e.DATABASE_URL),
    sessionSecretConfigured: e.SESSION_SECRET.length >= 16,
  };
}

function maskHost(url: string) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}`;
  } catch {
    return "invalid";
  }
}
