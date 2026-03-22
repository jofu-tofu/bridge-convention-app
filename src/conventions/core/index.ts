// ── conventions/core public API barrel ──────────────────────────────────
// External consumers import from here.
// Internal files within conventions/ use direct paths.

// ── Types & Config ──────────────────────────────────────────────────────
export { ConventionCategory } from "../../core/contracts/convention";
export type {
  ConventionConfig,
  ConventionLookup,
  ConventionTeaching,
} from "../../core/contracts/convention";

// ── Registry ────────────────────────────────────────────────────────────
export {
  registerConvention,
  clearRegistry,
  getConvention,
  listConventions,
} from "./registry";

// ── Context Factory ─────────────────────────────────────────────────────
export { createBiddingContext } from "./context-factory";

// ── Bundle (sub-barrel) ─────────────────────────────────────────────────
export { findBundleForConvention, getBundle, listBundles, composeBundles, resolveConventionForSystem } from "./bundle";
export type { ConventionBundle, BundleInput } from "./bundle";

// ── Pipeline ────────────────────────────────────────────────────────────
export {
  evaluateFacts,
  createSharedFactCatalog,
  createHandFactResolver,
} from "./pipeline/fact-evaluator";
export type { RelationalFactContext, EvaluateFactsOptions } from "./pipeline/fact-evaluator";

export { createSystemFactCatalog } from "./pipeline/system-fact-catalog";

export { evaluateAllBidMeanings } from "./pipeline/meaning-evaluator";

export {
  arbitrateMeanings,
  zipProposalsWithSurfaces,
  pipelineResultToArbitration,
  pipelineResultToProvenance,
} from "./pipeline/meaning-arbitrator";

// ── Runtime (remaining) ─────────────────────────────────────────────────
export type {
  RuntimeModule,
  DecisionSurfaceEntry,
  RuntimeDiagnostic,
  EvaluationResult,
} from "./runtime/types";

export type {
  MachineRegisters,
} from "./runtime/machine-types";

// ── Protocol Frame Architecture (legacy — retained for ConventionSpec type) ──
export type { ConventionSpec } from "./protocol/types";

// ── Rule Enumeration ────────────────────────────────────────────────────
export { enumerateRuleAtoms, generateRuleCoverageManifest } from "./pipeline/rule-enumeration";
export type { RuleAtom, RuleCoverageManifest } from "./pipeline/rule-enumeration";

// ── Rule interpretation workflow — used by strategy/bidding/protocol-adapter ──
export { collectMatchingClaims, collectMatchingClaimsWithPhases, deriveTurnRole, flattenSurfaces } from "./pipeline/rule-interpreter";
export type { ModuleClaimResult } from "./pipeline/rule-interpreter";
export { normalizeIntent } from "./pipeline/normalize-intent";
export { matchObs } from "./pipeline/route-matcher";
export { advanceLocalFsm } from "./pipeline/local-fsm";

// ── Convention Module (unified type) ─────────────────────────────────────
export type { ConventionModule, Claim, LocalFsm } from "./convention-module";
export { moduleSurfaces } from "./convention-module";

// ── System Registry (re-exported from definitions for external consumers) ────
export { getBundleInput, listBundleInputs, resolveBundle, specFromBundle } from "../definitions/system-registry";
/** @deprecated Use getBundleInput() + resolveBundle() instead. */
export { getSystemBundle, listSystemBundles } from "../definitions/system-registry";
