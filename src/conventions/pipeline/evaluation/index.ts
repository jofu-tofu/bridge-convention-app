// ── evaluation/ barrel ─────────────────────────────────────────────────
// Meaning evaluation + arbitration: surfaces × facts → ranked pipeline result.

export { evaluateAllBidMeanings, evaluateBidMeaning } from "./meaning-evaluator";
export {
  compareRanking,
  BAND_PRIORITY,
  BRIDGE_SEMANTIC_CLASSES,
} from "./meaning";
export type {
  BidMeaning,
  MeaningProposal,
  MeaningClause,
  BidMeaningClause,
  MeaningId,
  SemanticClassId,
  RankingMetadata,
  AuthoredRankingMetadata,
  RecommendationBand,
  SpecificityBasis,
  ConstraintDimension,
  FactOperator,
  EvaluationEvidence,
} from "./meaning";
export { resolveFactId, resolveClause } from "./binding-resolver";
export { deriveClauseId, deriveClauseDescription, fillClauseDefaults } from "./clause-derivation";
export { deriveSpecificity } from "./specificity-deriver";
export { classifySpecificityBasis } from "./specificity-classifier";
export { CANON_DIMENSIONAL_COUNT, DIMENSION_PRIORITY, CANON_DIMENSION_PRIORITY, CANON_CONVENTION_DEPTH, CANON_NAMED_SUIT, compareByCanons } from "./specificity-canons";
export { resolveAlert, isAlertable } from "./alert";
export type { AlertResolvable } from "./alert";
export { arbitrateMeanings, zipProposalsWithSurfaces } from "./meaning-arbitrator";
export type { ArbitrationInput } from "./meaning-arbitrator";
export { evaluateProposal, classifyIntoSets } from "./arbitration-helpers";
export { resolveEncoding } from "./encoder-resolver";
export type { EncoderConfig, FrontierStepConfig, RelayMapConfig } from "./encoder-resolver";
export { evaluateGates } from "./gate-order";
export type { GateId } from "./gate-order";
export type {
  DecisionProvenance,
  ApplicabilityEvidence,
  EliminationTrace,
  ActivationTrace,
  ArbitrationTrace,
  EncodingTrace,
  LegalityTrace,
  HandoffTrace,
  EncoderKind,
} from "./provenance";
