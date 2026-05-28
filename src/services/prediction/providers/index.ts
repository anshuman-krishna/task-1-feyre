import type { PredictionProviderImpl } from "../types";
import { mockProvider } from "./mock";
import { internalProvider } from "./internal";
import { groqProvider, openaiProvider } from "./external";
import { isAvailable } from "./circuit";
import { log } from "@/server/logger";

const registry: Record<string, PredictionProviderImpl> = {
  mock: mockProvider,
  internal: internalProvider,
  openai: openaiProvider,
  groq: groqProvider,
};

const FALLBACK = internalProvider;

// returns the requested provider unless its circuit is open, in which case
// the internal heuristic provider takes over. internal itself is never
// degraded — it's the floor.
export function getProvider(name?: string): PredictionProviderImpl {
  const key = (name ?? process.env.AI_PROVIDER ?? "internal").toLowerCase();
  const chosen = registry[key] ?? FALLBACK;
  if (chosen.name === FALLBACK.name) return chosen;
  if (!isAvailable(chosen.name)) {
    log.warn("provider.degraded", { requested: chosen.name, fallback: FALLBACK.name });
    return FALLBACK;
  }
  return chosen;
}

export function listProviders() {
  return Object.values(registry).map((p) => ({ name: p.name, model: p.model ?? null }));
}

export { recordSuccess, recordFailure, snapshot as providerCircuitSnapshot } from "./circuit";
