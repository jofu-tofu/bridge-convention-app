// ── Inference module public API ──────────────────────────────

// Types
export type {
  InferenceConfig,
  InferenceProvider,
  InferenceSnapshot,
  PublicBeliefState,
  BidAnnotation,
  InferenceExtractorInput,
  InferenceExtractor,
  ConditionInference,
} from "./types";

// Re-export cross-boundary types surfaced through inference
export type { SuitInference, HandInference, InferredHoldings } from "./types";

// Engine
export type { InferenceEngine } from "./inference-engine";
export { createInferenceEngine } from "./inference-engine";

// Belief accumulator
export { createInitialBeliefState, applyAnnotation } from "./belief-accumulator";

// Annotation producer
export { produceAnnotation } from "./annotation-producer";

// Noop extractor (default / placeholder)
export { noopExtractor } from "./noop-extractor";

// Natural inference provider
export { createNaturalInferenceProvider } from "./natural-inference";

// Private belief state
export type { PrivateBeliefState } from "./private-belief";

// Posterior sub-module
export * from "./posterior";
