import type { PredictionProviderImpl } from "../types";
import { mockProvider } from "./mock";
import { internalProvider } from "./internal";
import { groqProvider, openaiProvider } from "./external";

const registry: Record<string, PredictionProviderImpl> = {
  mock: mockProvider,
  internal: internalProvider,
  openai: openaiProvider,
  groq: groqProvider,
};

export function getProvider(name?: string): PredictionProviderImpl {
  const key = (name ?? process.env.AI_PROVIDER ?? "internal").toLowerCase();
  return registry[key] ?? internalProvider;
}

export function listProviders() {
  return Object.values(registry).map((p) => ({ name: p.name, model: p.model ?? null }));
}
