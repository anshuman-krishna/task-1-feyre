import type { PredictionProviderImpl } from "../types";

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
      contributions: [],
    };
  },
};
