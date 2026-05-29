// AI orchestration entry. callers should never import individual provider
// or prompt modules — the orchestration layer is the single contract.

export { runAI, type AIRun } from "./orchestration";
export { promptFor, PROMPTS } from "./prompts";
export { loadPatientMemory } from "./memory";
export {
  getPatientSummary,
  refreshPatientSummary,
  type StoredSummary,
} from "./summarizers/patient";
export {
  getAIProvider,
  listAIProviders,
  isAvailable as isAIProviderAvailable,
} from "./providers";
export type {
  AITaskKind,
  AIOutput,
  AIRunMeta,
  PatientSummaryOutput,
  HandoffOutput,
  DigestOutput,
  FollowUpBriefOutput,
  AIObservation,
  AIRecommendedAction,
} from "./types";
