import { log } from "@/server/logger";
import type { AIProvider } from "./types";
import { internalAIProvider } from "./internal";
import { openaiAIProvider, groqAIProvider } from "./external";

const registry: Record<string, AIProvider> = {
  internal: internalAIProvider,
  openai: openaiAIProvider,
  groq: groqAIProvider,
};

const FALLBACK = internalAIProvider;

// per-provider failure counters. very small circuit: 3 consecutive
// failures open a provider for 30s. internal is never degraded.
type CircuitState = { failures: number; openedAt: number | null };
const circuit: Record<string, CircuitState> = {};
const OPEN_AFTER = 3;
const COOLDOWN_MS = 30_000;

function circuitFor(name: string): CircuitState {
  return (circuit[name] ??= { failures: 0, openedAt: null });
}

export function isAvailable(name: string): boolean {
  if (name === FALLBACK.name) return true;
  const c = circuitFor(name);
  if (c.openedAt == null) return true;
  if (Date.now() - c.openedAt < COOLDOWN_MS) return false;
  c.openedAt = null;
  c.failures = 0;
  return true;
}

export function recordSuccess(name: string) {
  const c = circuitFor(name);
  c.failures = 0;
  c.openedAt = null;
}

export function recordFailure(name: string) {
  const c = circuitFor(name);
  c.failures += 1;
  if (c.failures >= OPEN_AFTER) {
    c.openedAt = Date.now();
    log.warn("ai.provider.open", { provider: name, failures: c.failures });
  }
}

export function getAIProvider(name?: string): { provider: AIProvider; degraded: boolean; reason?: string } {
  const key = (name ?? process.env.AI_ORCHESTRATOR ?? "internal").toLowerCase();
  const chosen = registry[key] ?? FALLBACK;
  if (chosen.name === FALLBACK.name) return { provider: FALLBACK, degraded: false };
  if (!isAvailable(chosen.name)) {
    return { provider: FALLBACK, degraded: true, reason: "circuit_open" };
  }
  return { provider: chosen, degraded: false };
}

export function listAIProviders() {
  return Object.values(registry).map((p) => ({
    name: p.name,
    model: p.model ?? null,
    available: isAvailable(p.name),
  }));
}

export type { AIProvider } from "./types";
