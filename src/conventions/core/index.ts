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
export { findBundleForConvention, getBundle, composeBundles } from "./bundle";
export type { ConventionBundle } from "./bundle";

// ── Pipeline ────────────────────────────────────────────────────────────
export {
  evaluateFacts,
  createSharedFactCatalog,
  createHandFactResolver,
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

// ── Runtime (remaining) ─────────────────────────────────────────────────
export { buildSnapshotFromAuction } from "./runtime/public-snapshot-builder";
export { bundleToRuntimeModules } from "./runtime/bundle-adapter";

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

// ── Protocol Frame Architecture ─────────────────────────────────────────
export type { ConventionSpec, ModuleSpec, BaseModuleSpec, ProtocolModuleSpec } from "./protocol/types";
export { getBaseModules, getProtocolModules } from "./protocol/types";
