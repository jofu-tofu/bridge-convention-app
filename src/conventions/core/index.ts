// ── conventions/core internal barrel ────────────────────────────────────
// Internal barrel — external consumers use conventions/index.ts.
// Kept for conventions-internal convenience imports.

// ── Types & Config ──────────────────────────────────────────────────────
export { ConventionCategory } from "./convention-types";
export type {
  ConventionConfig,
  ConventionLookup,
  ConventionTeaching,
} from "./convention-types";

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
export type { ConventionModule, ResolvedSurface, LocalFsm, StateEntry } from "./convention-module";
export { moduleSurfaces } from "./convention-module";

// ── Fact Catalog (moved from core/contracts/) ───────────────────────────
export { getFactValue, createFactCatalog, num, bool, fv } from "./fact-catalog";
export { FactLayer } from "./fact-layer";
export type {
  EvaluationWorld,
  PrimitiveClause,
  FactComposition,
  FactDefinition,
  FactValue,
  EvaluatedFacts,
  FactEvaluatorFn,
  RelationalFactEvaluatorFn,
  PosteriorFactEvaluatorFn,
  PosteriorFactEvaluator,
  FactCatalogExtension,
  FactCatalog,
  HandFactResolverFn,
} from "./fact-catalog";

// ── Agreement Module (moved from core/contracts/) ───────────────────────
export type {
  AuctionPattern,
  PublicGuard,
  HandPredicate,
  DealConstraint,
  ModuleKind,
  Attachment,
  FactConstraint,
  SystemProfile,
  ModuleEntry,
  DeclaredEncoderKind,
  PublicEvent,
  PublicConstraint,
} from "./agreement-module";

// ── Explanation Catalog (moved from core/contracts/) ────────────────────
export { createExplanationCatalog } from "./explanation-catalog";
export type {
  ExplanationRole,
  ExplanationLevel,
  FactExplanationEntry,
  MeaningExplanationEntry,
  ExplanationEntry,
  ExplanationCatalog,
} from "./explanation-catalog";

// ── Shared Facts (moved from core/contracts/) ───────────────────────────
export {
  HAND_HCP, HAND_SUIT_LENGTH_SPADES, HAND_SUIT_LENGTH_HEARTS,
  HAND_SUIT_LENGTH_DIAMONDS, HAND_SUIT_LENGTH_CLUBS, HAND_IS_BALANCED,
  PRIMITIVE_FACT_IDS, BRIDGE_IS_VULNERABLE, BRIDGE_HAS_FOUR_CARD_MAJOR,
  BRIDGE_HAS_FIVE_CARD_MAJOR, BRIDGE_MAJOR_PATTERN, BRIDGE_SUPPORT_FOR_BOUND_SUIT,
  BRIDGE_FIT_WITH_BOUND_SUIT, BRIDGE_HAS_SHORTAGE, BRIDGE_SHORTAGE_IN_SUIT,
  BRIDGE_TOTAL_POINTS_FOR_RAISE, BRIDGE_DERIVED_FACT_IDS,
  BRIDGE_PARTNER_HAS_4_HEARTS_LIKELY, BRIDGE_PARTNER_HAS_4_SPADES_LIKELY,
  BRIDGE_PARTNER_HAS_4_DIAMONDS_LIKELY, BRIDGE_PARTNER_HAS_4_CLUBS_LIKELY,
  BRIDGE_COMBINED_HCP_IN_RANGE_LIKELY, POSTERIOR_FACT_IDS,
  SHARED_FACT_ID_LIST,
} from "./shared-fact-vocabulary";
export type {
  PrimitiveFactId, BridgeDerivedFactId, PosteriorFactId, SharedFactId,
} from "./shared-fact-vocabulary";

export { PRIMITIVE_FACTS, BRIDGE_DERIVED_FACTS, POSTERIOR_DERIVED_FACTS, SHARED_FACTS } from "./shared-facts";

// ── Module Surface (moved from core/contracts/) ─────────────────────────
export { buildPublicSnapshot } from "./module-surface";
export type { MachineRegisters as ModuleSurfaceMachineRegisters, PublicSnapshot } from "./module-surface";

// ── Committed Step (moved from core/contracts/) ─────────────────────────
export { INITIAL_NEGOTIATION } from "./committed-step";
export type {
  NegotiationState,
  NegotiationDelta,
  ClaimRef,
  CommittedStep,
  AuctionContext,
} from "./committed-step";
