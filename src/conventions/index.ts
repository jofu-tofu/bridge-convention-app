// ── conventions/ public API barrel ──────────────────────────────────────
// This is the ONLY public import path for external consumers
// (cli/, service/, session/, stores/, components/).
// ESLint enforces no deep imports into conventions/core/, conventions/pipeline/,
// conventions/adapter/, conventions/teaching/, or conventions/definitions/.

// ── Side-effect registration (must be first — registers bundles before any consumer access) ──
import "./registration";

// ── Pipeline types (re-exported from contracts — physically stay there) ──
export type {
  BidMeaning,
  BidMeaningClause,
} from "./pipeline/evaluation/meaning";
export { deriveNeutralDescription } from "./pipeline/evaluation/clause-derivation";

export type {
  EncoderKind,
} from "./pipeline/evaluation/provenance";

export type {
  TeachingProjection,
  ParseTreeView,
  ConventionContribution,
} from "./teaching/teaching-types";

// ── Pipeline types (moved from contracts) ───────────────────────────────
export type { PipelineResult, PipelineCarrier, ArbitrationResult, EncodedProposal } from "./pipeline/pipeline-types";
export type { StrategyEvaluation, ConventionStrategy, MachineDebugSnapshot } from "./pipeline/strategy-evaluation";
export { isAlertable } from "./pipeline/evaluation/alert";
export type { BidAction } from "./pipeline/bid-action";

// ── Pipeline functions (moved in Phase 1) ───────────────────────────────
export { createSharedFactCatalog } from "./pipeline/facts/shared-fact-catalog";
export { createSystemFactCatalog } from "./pipeline/facts/system-fact-catalog";
export { collectMatchingClaims, collectMatchingClaimsWithPhases, deriveTurnRole, flattenSurfaces } from "./pipeline/observation/rule-interpreter";
export type { ModuleSurfaceResult } from "./pipeline/observation/rule-interpreter";
export { normalizeIntent } from "./pipeline/observation/normalize-intent";
export { matchObs } from "./pipeline/observation/route-matcher";
export { advanceLocalFsm } from "./pipeline/observation/local-fsm";
export { enumerateRuleAtoms, generateRuleCoverageManifest } from "./pipeline/rule-enumeration";
export type { RuleAtom, RuleCoverageManifest } from "./pipeline/rule-enumeration";
export { runPipeline } from "./pipeline/run-pipeline";

// ── Core (registry, context, modules, bundles) ─────────────────────────
export { ConventionCategory } from "./core/convention-types";
export type { ConventionConfig } from "./core/convention-types";
export { getConvention, listConventions } from "./core/registry";
export { createBiddingContext } from "./core/context-factory";
export { getBundle, resolveConventionForSystem } from "./core/bundle";
export type { ConventionBundle } from "./core/bundle";
export type { ConventionSpec } from "./core/protocol/types";
export type { ConventionModule, ResolvedSurface, LocalFsm, StateEntry } from "./core/convention-module";
export { moduleSurfaces } from "./core/convention-module";
export type { ObsPattern, TurnRole, NegotiationExpr, RouteExpr } from "./core/rule-module";
export { INITIAL_NEGOTIATION } from "./core/committed-step";
export type { AuctionContext, NegotiationState, CommittedStep } from "./core/committed-step";
export type { PublicSnapshot } from "./core/module-surface";
export type { ExplanationEntry } from "./core/explanation-catalog";
export type { TeachingControls } from "./core/deal-spec-types";

// ── Bundle test helpers ─────────────────────────────────────────────────
export { registerBundle, clearBundleRegistry, createConventionConfigFromBundle } from "./core/bundle";

// ── Definitions (module registry) ──────────────────────────────────────
export { getModule, getAllModules } from "./definitions/module-registry";

// ── Definitions (system registry) ──────────────────────────────────────
export { getBundleInput, listBundleInputs, resolveBundle, specFromBundle } from "./definitions/system-registry";

// ── Definitions (system config) ──────────────────────────────────────────
export type { BaseSystemId, SystemConfig } from "./definitions/system-config";
export { SAYC_SYSTEM_CONFIG, AVAILABLE_BASE_SYSTEMS, BASE_SYSTEM_SAYC, BASE_SYSTEM_ACOL, getSystemConfig } from "./definitions/system-config";

// ── Definitions (concrete bundles — for test setup) ─────────────────────
export { ntBundle } from "./definitions/nt-bundle";
export { bergenBundle } from "./definitions/bergen-bundle";

// ── Fact catalog ─────────────────────────────────────────────────────────
export type { EvaluatedFacts } from "./core/fact-catalog";

// ── Platform explanation catalog ─────────────────────────────────────────
export { PLATFORM_EXPLANATION_ENTRIES } from "./core/shared-explanation-catalog";

// ── Strategy contract types (shared bidding/play interfaces + DTOs) ──
export {
  ForcingState,
} from "./core/strategy-types";
export type {
  BiddingContext,
  BidAlert,
  BidResult,
  BidHistoryEntry,
  BiddingStrategy,
  PlayContext,
  PlayResult,
  PlayStrategy,
  PosteriorSummary,
  PracticalScoreBreakdown,
  PracticalRecommendation,
} from "./core/strategy-types";

// ── Adapter (convention→strategy bridge) ─────────────────────────────
export { protocolSpecToStrategy, buildObservationLogViaRules } from "./adapter/protocol-adapter";
export { LEVEL_HCP_TABLE } from "./adapter/practical-scorer";
export { TraceCollector } from "./adapter/trace-collector";

// ── Teaching (resolution, projection, parse-tree) ─────────────────────
export { resolveTeachingAnswer, gradeBid, BidGrade } from "./teaching/teaching-resolution";
export type { TeachingResolution } from "./teaching/teaching-resolution";
export { projectTeaching } from "./teaching/teaching-projection-builder";
