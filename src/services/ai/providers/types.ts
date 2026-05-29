import type { AITaskKind, AIOutput } from "../types";

export type AIRequest<T extends AITaskKind = AITaskKind> = {
  task: T;
  promptId: string;
  // structured context — providers may serialise to text internally.
  context: Record<string, unknown>;
};

export interface AIProvider {
  name: string;
  model?: string;
  // returns a structured output. providers are responsible for ensuring
  // the output validates against the expected shape for the requested task.
  complete(req: AIRequest): Promise<AIOutput>;
}
