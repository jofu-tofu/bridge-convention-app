// ── conventions/core internal barrel ────────────────────────────────────
// Internal barrel — external consumers use conventions/index.ts.
// Kept for conventions-internal convenience imports.

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

// ── Runtime ─────────────────────────────────────────────────────────────
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

// ── Convention Module (unified type) ─────────────────────────────────────
export type { ConventionModule, Claim, LocalFsm, StateEntry } from "./convention-module";
export { moduleSurfaces } from "./convention-module";
