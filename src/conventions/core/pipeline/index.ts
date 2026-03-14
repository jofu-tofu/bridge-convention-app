// ─── Meaning Pipeline ──────────────────────────────────────────
//
// 5-step pure transformation for convention resolution:
//
//   surfaces → compose → evaluate facts → evaluate meanings → arbitrate
//
// Entry point: `runMeaningPipeline()` in meaning-strategy.ts wraps these
// building blocks into a single call. Individual functions are exported
// below for testing and advanced consumers.
//
// Data flow:
//   MeaningSurface[]  ─── composeSurfaces ──→  composed[]
//   composed[]        ─── evaluateFacts ────→  EvaluatedFacts
//   composed[] + facts ── evaluateAllSurfaces → MeaningProposal[]
//   proposals[]       ─── arbitrateMeanings ─→  ArbitrationResult
//

export { evaluateFacts, createSharedFactCatalog } from "./fact-evaluator";
export {
  evaluateMeaningSurface,
  evaluateAllSurfaces,
  evaluateDecisionSurface,
  isMeaningSurface,
} from "./meaning-evaluator";
export type { EvaluableSurface } from "./meaning-evaluator";
export { arbitrateMeanings, zipProposalsWithSurfaces } from "./meaning-arbitrator";
export { composeSurfaces, mergeUpstreamProvenance } from "./surface-composer";
export { adaptMeaningSurface, adaptMeaningSurfaces } from "./surface-adapter";
export { resolveEncoding } from "./encoder-resolver";
export type {
  FrontierStepConfig,
  RelayMapConfig,
  RelayMapEntry,
  EncoderConfig,
  EncodingResolution,
} from "./encoder-resolver";
