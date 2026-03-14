// ── conventions/core public API barrel ──────────────────────────────────
// External consumers import from here.
// Internal files within conventions/ use direct paths.

// ── Types & Config ──────────────────────────────────────────────────────
export { ConventionCategory } from "./types";
export type {
  ConventionConfig,
  BiddingContext,
  ConventionLookup,
  ConventionTeaching,
} from "./types";

// ── Registry ────────────────────────────────────────────────────────────
export {
  registerConvention,
  clearRegistry,
  getConvention,
  listConventions,
  listConventionIds,
} from "./registry";

// ── Context Factory ─────────────────────────────────────────────────────
export { createBiddingContext } from "./context-factory";

// ── Bundle (sub-barrel) ─────────────────────────────────────────────────
export { findBundleForConvention, getBundle } from "./bundle";
export type { ConventionBundle } from "./bundle";

// ── Fact Evaluator ──────────────────────────────────────────────────────
export { createSharedFactCatalog } from "./pipeline/fact-evaluator";
