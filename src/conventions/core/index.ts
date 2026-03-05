// Core barrel export — convenience re-exports for convention consumers.
// Existing deep imports continue working; this is optional.

// ─── Types ───────────────────────────────────────────────────
export type {
  BiddingContext,
  ConventionConfig,
  RuleCondition,
  AuctionCondition,
  HandCondition,
  ConditionResult,
  ConditionInference,
  BiddingRuleResult,
  ConventionTeaching,
  InterferenceSignature,
  ConventionCategory,
  ConventionLookup,
} from "./types";

// ─── Registry ────────────────────────────────────────────────
export {
  registerConvention,
  getConvention,
  evaluateBiddingRules,
  computeTriggerOverridesForConfig,
  applyProtocolOverlays,
  clearRegistry,
  getDiagnostics,
  listConventions,
  listConventionIds,
  getEffectiveRules,
  getConventionRules,
} from "./registry";
export type { DebugRuleResult } from "./registry";

// ─── Tree ────────────────────────────────────────────────────
export {
  handDecision,
  decision,
  fallback,
  validateTree,
} from "./rule-tree";
export type {
  RuleNode,
  HandNode,
  DecisionNode,
  HandDecisionNode,
  FallbackNode,
  BidMetadata,
  DecisionMetadata,
  ConventionExplanations,
} from "./rule-tree";

// ─── Protocol ────────────────────────────────────────────────
export { protocol, round, semantic } from "./protocol";
export type {
  ConventionProtocol,
  ProtocolRound,
  EstablishedContext,
  SemanticTrigger,
  ProtocolEvalResult,
} from "./protocol";

// ─── Intent ──────────────────────────────────────────────────
export {
  createIntentBidFactory,
  intentBid,
  SemanticIntentType,
} from "./intent";
export type {
  IntentResolverFn,
  IntentResolverMap,
  ResolverResult,
  ResolvedIntent,
  SemanticIntent,
  IntentNode,
} from "./intent";

// ─── Dialogue ────────────────────────────────────────────────
export * from "./dialogue";

// ─── Pipeline ────────────────────────────────────────────────
export { buildEffectiveContext } from "./effective-context";
export type { EffectiveConventionContext } from "./effective-context";
export { generateCandidates } from "./candidate-generator";
export type { ResolvedCandidate, CandidateGenerationResult } from "./candidate-generator";
export { selectMatchedCandidate } from "./candidate-selector";
export type { CandidateRankerFn } from "./candidate-selector";

// ─── Overlay ─────────────────────────────────────────────────
export type { ConventionOverlayPatch } from "./overlay";
export { validateOverlayPatches } from "./overlay";

// ─── Context ─────────────────────────────────────────────────
export { createBiddingContext } from "./context-factory";

// ─── Conditions ──────────────────────────────────────────────
export * from "./conditions";

// ─── Inference ───────────────────────────────────────────────
export { evaluateForInference } from "./inference-api";
export type {
  InferenceRuleDTO,
  InferenceTreeResultDTO,
  ConventionInferenceData,
} from "./inference-api";
