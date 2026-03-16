// ── conventions/core public API barrel ──────────────────────────────────
// External consumers import from here.
// Internal files within conventions/ use direct paths.

// ── Types & Config ──────────────────────────────────────────────────────
export { ConventionCategory } from "./types";
export type {
  ConventionConfig,
  ConventionLookup,
  ConventionTeaching,
} from "./types";

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
export { findBundleForConvention, getBundle, composeBundles, createBundle } from "./bundle";
export type { ConventionBundle, CreateBundleConfig } from "./bundle";

// ── Pipeline ────────────────────────────────────────────────────────────
export {
  evaluateFacts,
  createSharedFactCatalog,
} from "./pipeline/fact-evaluator";
export type { RelationalFactContext } from "./pipeline/fact-evaluator";

export { evaluateAllSurfaces } from "./pipeline/meaning-evaluator";

export {
  arbitrateMeanings,
  zipProposalsWithSurfaces,
} from "./pipeline/meaning-arbitrator";

export {
  composeSurfaces,
  mergeUpstreamProvenance,
} from "./pipeline/surface-composer";

// ── Runtime ─────────────────────────────────────────────────────────────
export { evaluate } from "./runtime/evaluation-runtime";
export { evaluateMachine } from "./runtime/machine-evaluator";
export { buildSnapshotFromAuction } from "./runtime/public-snapshot-builder";

export type {
  RuntimeModule,
  DecisionSurfaceEntry,
  RuntimeDiagnostic,
  EvaluationResult,
} from "./runtime/types";

export type {
  ConversationMachine,
  MachineEvalResult,
  MachineRegisters,
  MachineState,
  MachineTransition,
  MachineEffect,
  MachineContext,
} from "./runtime/machine-types";
export { buildConversationMachine } from "./runtime/machine-types";

// ── Composition (bottom-up module assembly) ──────────────────────────────
export type { ConventionModule, BundleSkeleton, ComposedBundle } from "./composition";
export { composeModules } from "./composition";

// ── Profile (profile-centric composition) ────────────────────────────────
export type { CompiledProfile, ResolvedModuleEntry, LegacyCompiledProfile } from "./profile";
export { compileProfileFromBundle } from "./profile";

// ── Modules (package-based authoring) ────────────────────────────────────
export type {
  ModulePackage,
  ModuleRequirement,
  MeaningSurfaceContribution,
} from "./modules";
export type { MachineFragment, FrontierDeclaration } from "./modules";
export type { HandoffSpec, HandoffTrigger } from "./modules";
export type { SurfaceEmitterSpec } from "./modules";
export type { BundleReconstructionMeta } from "./modules";
export { conventionBundleToPackages, packagesToConventionBundle } from "./modules";
