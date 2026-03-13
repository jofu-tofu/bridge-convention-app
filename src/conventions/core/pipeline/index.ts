// Pipeline subsystem barrel — meaning pipeline only.

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
