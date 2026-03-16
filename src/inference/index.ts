// inference barrel — public API for external consumers.

// Types
export type {
  ConditionInference,
  InferenceConfig,
  InferenceExtractor,
  InferenceExtractorInput,
  InferenceProvider,
  InferenceSnapshot,
  PublicBeliefState,
  BidAnnotation,
  // Re-exports from core/contracts (via ./types)
  SuitInference,
  HandInference,
  InferredHoldings,
} from "./types";

// Inference engine
export { createInferenceEngine } from "./inference-engine";
export type { InferenceEngine } from "./inference-engine";

// Belief accumulator
export { createInitialBeliefState, applyAnnotation } from "./belief-accumulator";

// Annotation producer
export { produceAnnotation } from "./annotation-producer";

// Noop extractor
export { noopExtractor } from "./noop-extractor";

// Natural inference provider
export { createNaturalInferenceProvider } from "./natural-inference";

// Private belief
export { conditionOnOwnHand } from "./private-belief";
export type { PrivateBeliefState } from "./private-belief";

// Posterior sub-module
export * from "./posterior/index";
