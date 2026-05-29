import type { AIProvider } from "./types";
import { AIError } from "../types";

// stubs for live LLM providers. wired off until keys are present.
// the orchestrator routes around these when their circuits open, falling
// back to the internal provider — so the system never goes silent.

export const openaiAIProvider: AIProvider = {
  name: "openai",
  model: "gpt-4o-mini",
  async complete() {
    throw new AIError("openai provider not configured", "openai", false);
  },
};

export const groqAIProvider: AIProvider = {
  name: "groq",
  model: "llama-3.1-70b-versatile",
  async complete() {
    throw new AIError("groq provider not configured", "groq", false);
  },
};
