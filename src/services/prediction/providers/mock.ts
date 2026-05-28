import type { PredictionProviderImpl } from "../types";

// fixed-output provider for tests and demos.
// kept around so the registry has at least one zero-logic baseline.
export const mockProvider: PredictionProviderImpl = {
  name: "mock",
  model: "mock-fixed-v0",
  async predict() {
    return {
      riskLevel: "low",
      condition: "no significant indicators",
      confidence: 0.7,
      summary: "Static placeholder output from the mock provider.",
      recommendations: ["routine follow-up"],
      observations: [],
    };
  },
};
