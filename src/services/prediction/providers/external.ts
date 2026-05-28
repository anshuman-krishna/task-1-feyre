import { PredictionError, type PredictionProviderImpl } from "../types";

// stubs for the external providers. wiring lands when API keys are present.
// kept here so getProvider() can resolve the names without a separate registry.

export const openaiProvider: PredictionProviderImpl = {
  name: "openai",
  model: "gpt-4o-mini",
  async predict() {
    throw new PredictionError("openai provider not configured", "openai", false);
  },
};

export const groqProvider: PredictionProviderImpl = {
  name: "groq",
  model: "llama-3.1-70b-versatile",
  async predict() {
    throw new PredictionError("groq provider not configured", "groq", false);
  },
};
