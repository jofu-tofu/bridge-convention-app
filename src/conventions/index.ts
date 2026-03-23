// ── conventions/ public API barrel ──────────────────────────────────────
// This is the ONLY public import path for external consumers
// (strategy/, evaluation/, cli/, bootstrap/, service/, stores/, components/).
// ESLint enforces no deep imports into conventions/core/, conventions/pipeline/,
// conventions/teaching/, or conventions/definitions/.

// ── Side-effect registration (must be first — registers bundles before any consumer access) ──
import "./registration";

// ── Pipeline types (re-exported from contracts — physically stay there) ──
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
} from "../core/contracts/meaning";
export { compareRanking, BAND_PRIORITY } from "../core/contracts/meaning";

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
} from "../core/contracts/provenance";

export type {
  CandidateEligibility,
  ResolvedCandidateDTO,
  EvaluationTrace,
} from "../core/contracts/tree-evaluation";
export { isDtoSelectable, isDtoTeachingAcceptable } from "../core/contracts/tree-evaluation";

export type {
  TeachingProjection,
  CallProjection,
  MeaningView,
  ParseTreeView,
  WhyNotEntry,
  ConventionContribution,
  ParseTreeModuleNode,
  ParseTreeCondition,
} from "../core/contracts/teaching-projection";

// ── Pipeline types (moved from contracts) ───────────────────────────────
export type { PipelineResult, PipelineCarrier, ArbitrationResult, EncodedProposal, EliminationRecord } from "./pipeline/pipeline-types";
export type { StrategyEvaluation, ConventionStrategy, MachineDebugSnapshot } from "./pipeline/strategy-evaluation";
export { resolveAlert, isAlertable } from "./pipeline/alert";
export type { AlertResolvable } from "./pipeline/alert";

// ── Pipeline functions (moved in Phase 1) ───────────────────────────────
export { evaluateFacts } from "./pipeline/fact-evaluator";
export type { RelationalFactContext, EvaluateFactsOptions } from "./pipeline/fact-evaluator";
export { createSharedFactCatalog } from "./pipeline/shared-fact-catalog";
export { createSystemFactCatalog } from "./pipeline/system-fact-catalog";
export { createHandFactResolver } from "./pipeline/hand-fact-resolver";
export { evaluateAllBidMeanings } from "./pipeline/meaning-evaluator";
export { arbitrateMeanings, zipProposalsWithSurfaces } from "./pipeline/meaning-arbitrator";
export { collectMatchingClaims, collectMatchingClaimsWithPhases, deriveTurnRole, flattenSurfaces } from "./pipeline/rule-interpreter";
export type { ModuleSurfaceResult } from "./pipeline/rule-interpreter";
export { normalizeIntent } from "./pipeline/normalize-intent";
export { matchObs } from "./pipeline/route-matcher";
export { advanceLocalFsm } from "./pipeline/local-fsm";
export { enumerateRuleAtoms, generateRuleCoverageManifest } from "./pipeline/rule-enumeration";
export type { RuleAtom, RuleCoverageManifest } from "./pipeline/rule-enumeration";
export { runPipeline } from "./pipeline/run-pipeline";
export type { PipelineInput, PipelineOutput } from "./pipeline/run-pipeline";

// ── Core (registry, context, modules, bundles) ─────────────────────────
export { ConventionCategory } from "../core/contracts/convention";
export type { ConventionConfig, ConventionLookup, ConventionTeaching } from "../core/contracts/convention";
export { registerConvention, clearRegistry, getConvention, listConventions } from "./core/registry";
export { createBiddingContext } from "./core/context-factory";
export { findBundleForConvention, getBundle, listBundles, composeBundles, resolveConventionForSystem } from "./core/bundle";
export type { ConventionBundle, BundleInput } from "./core/bundle";
export type { RuntimeModule, DecisionSurfaceEntry, RuntimeDiagnostic, EvaluationResult } from "./core/runtime/types";
export type { MachineRegisters } from "./core/runtime/machine-types";
export type { ConventionSpec } from "./core/protocol/types";
export type { ConventionModule, ResolvedSurface, LocalFsm, StateEntry } from "./core/convention-module";
export { moduleSurfaces } from "./core/convention-module";
export type { ObsPattern, TurnRole, NegotiationExpr, RouteExpr } from "./core/rule-module";

// ── Bundle test helpers ─────────────────────────────────────────────────
export { registerBundle, clearBundleRegistry, createConventionConfigFromBundle } from "./core/bundle";

// ── Definitions (system registry) ──────────────────────────────────────
export { getBundleInput, listBundleInputs, resolveBundle, specFromBundle } from "./definitions/system-registry";

// ── Definitions (concrete bundles — for test setup) ─────────────────────
export { ntBundle } from "./definitions/nt-bundle";
export { bergenBundle } from "./definitions/bergen-bundle";

// ── Platform explanation catalog ─────────────────────────────────────────
export { PLATFORM_EXPLANATION_ENTRIES } from "./core/shared-explanation-catalog";

// ── Teaching (resolution, projection, parse-tree) ─────────────────────
export { resolveTeachingAnswer, gradeBid, BidGrade } from "./teaching/teaching-resolution";
export type { AcceptableBid, TeachingResolution } from "./teaching/teaching-resolution";
export { projectTeaching } from "./teaching/teaching-projection-builder";
export type { TeachingProjectionOptions } from "./teaching/teaching-projection-builder";
export { buildParseTree } from "./teaching/parse-tree-builder";
