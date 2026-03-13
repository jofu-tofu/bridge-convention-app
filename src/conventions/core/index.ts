// ── conventions/core public API barrel ──────────────────────────────────
// External consumers (strategy/, inference/, bootstrap/, stores/, components/,
// teaching/, core/display/, engine/) import from here.
// Internal files within conventions/ use direct paths.

// ── Types & Config ──────────────────────────────────────────────────────
export { ConventionCategory } from "./types";
export type {
  ConventionConfig,
  BiddingContext,
  ConventionLookup,
  BiddingRule,
  ConditionResult,
  RuleCondition,
  AuctionCondition,
  HandCondition,
  ConditionInference,
  ConditionBranch,
  ConditionedBiddingRule,
  ConventionTeaching,
  BiddingRuleResult,
  InterferenceSignature,
  ExampleHand,
} from "./types";

// ── Registry ────────────────────────────────────────────────────────────
export {
  registerConvention,
  clearRegistry,
  getConvention,
  listConventions,
  listConventionIds,
  evaluateBiddingRules,
  evaluateAllBiddingRules,
  getEffectiveRules,
  isTreeConvention,
  getDiagnostics,
} from "./registry";
export type { DebugRuleResult } from "./registry";

// ── Tree (sub-barrel) ───────────────────────────────────────────────────
export {
  decision, handDecision, fallback, validateTree,
  evaluateTree,
  findSiblingBids, findCandidateBids,
} from "./tree";
export type {
  DecisionNode,
  FallbackNode,
  RuleNode,
  HandNode,
  HandDecisionNode,
  IntentNode,
  TreeConventionConfig,
  DecisionMetadata,
  BidMetadata,
  ConventionExplanations,
  BidAlert,
  TreeEvalResult,
  PathEntry,
} from "./tree";

// ── Context Factory ─────────────────────────────────────────────────────
export { createBiddingContext } from "./context-factory";

// ── Pipeline ─────────────────────────────────────────────────────────────
export {
  buildEffectiveContext, classifyInterference,
} from "./pipeline/effective-context";
export type {
  EffectiveConventionContext,
  BeliefData,
} from "./pipeline/effective-context";

export {
  generateCandidates,
} from "./pipeline/candidate-generator";
export type {
  ResolvedCandidate,
  CandidateProvenance,
  CandidateGenerationResult,
} from "./pipeline/candidate-generator";

export {
  selectMatchedCandidate,
  isSelectable,
  isPedagogicallyAcceptable,
} from "./pipeline/candidate-selector";
export type {
  CandidateRankerFn,
  SelectionResult,
} from "./pipeline/candidate-selector";

export {
  collectIntentProposals,
} from "./pipeline/intent-collector";
export type {
  CollectedIntent,
  PathConditionEntry,
} from "./pipeline/intent-collector";

// ── Condition Evaluator ─────────────────────────────────────────────────
export { evaluateConditions, buildExplanation, isConditionedRule } from "./condition-evaluator";

// ── Overlay (sub-barrel) ─────────────────────────────────────────────────
export { validateOverlayPatches, collectTriggerOverrides } from "./overlay";
export type { ConventionOverlayPatch } from "./overlay";

// ── Protocol (sub-barrel) ────────────────────────────────────────────────
export {
  protocol, round, semantic, validateProtocol,
  evaluateProtocol, resolveBranch,
} from "./protocol";
export type {
  ConventionProtocol,
  ProtocolRound,
  ProtocolBranch,
  SemanticTrigger,
  EstablishedContext,
  MatchedRoundEntry,
  ProtocolEvalResult,
} from "./protocol";

// ── Inference API ───────────────────────────────────────────────────────
export { evaluateForInference, isAuctionCondition } from "./inference-api";
export type {
  InferenceRuleDTO,
  InferenceTreeResultDTO,
  ConventionInferenceData,
} from "./inference-api";

// ── Debug Utils ─────────────────────────────────────────────────────────
export { reconstructBiddingContext } from "./debug-utils";

// ── Conditions (sub-barrel) ─────────────────────────────────────────────
export * from "./conditions";

// ── Dialogue (sub-barrel) ───────────────────────────────────────────────
export * from "./dialogue";

// ── Intent (sub-barrel) ─────────────────────────────────────────────────
export * from "./intent";
