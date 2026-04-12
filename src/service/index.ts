// ── Service module public API ────────────────────────────────────────

// ── 1. Service Port & Implementation ─────────────────────────────────
export type { DevServicePort } from "./port";
export { BridgeService } from "./wasm-service";
export type { DrillHandle, SessionConfig } from "./request-types";

// ── 2. Viewports & Response Types (service-owned) ────────────────────
export {
  ViewportBidGrade,
  ConventionCardSectionId,
  ConventionCardFormat,
} from "./response-types";
export type {
  ServicePublicBeliefs,
  ServicePublicBeliefState,
  ServiceInferenceSnapshot,
  ConventionCardLineItem,
  ConventionCardModuleDetail,
  ConventionCardSection,
  ConventionCardPanelView,
  BiddingViewport,
  ViewportBidFeedback,
  TeachingDetail,
  DeclarerPromptViewport,
  PlayingViewport,
  ExplanationViewport,
  ServiceDerivedRanges,
  PlayRecommendation,
  HandEvaluationView,
  AuctionEntryView,
  ModuleCatalogEntry,
  ModuleLearningViewport,
  FlowTreeNode,
  ModuleFlowTreeViewport,
  ClauseSystemVariant,
  ServiceBidHistoryEntry as BidHistoryEntry,
  BidAttemptRecord,
  ReviewCondition,
  BaseModuleInfo,
  ConventionInfo,
  ServiceExplanationNode,
  BiddingOptionView,
  AcblCardSection,
  AcblCardPanelView,
  ModuleConfigSchemaView,
  ConfigurableSurfaceView,
  ConfigurableParameter,
  ValidationResult,
  ValidationError,
} from "./response-types";

// ── 3. Game Vocabulary (engine primitives) ───────────────────────────
export { Seat, Suit, Rank, BidSuit, Vulnerability } from "../engine/types";
export type { Call, Card, Hand, ContractBid, Contract, Auction, AuctionEntry, Trick, PlayedCard, DDSolution, Deal } from "../engine/types";
export { SEAT_INDEX, SUIT_ORDER, RANK_INDEX, SEATS, nextSeat, partnerSeat } from "../engine/constants";
export { callKey, callsMatch } from "../engine/call-helpers";
export { isVulnerable } from "../engine/scoring";
export { evaluateHand, calculateHcp } from "../engine/hand-evaluator";

// ── 4. Convention & Session Types (service-owned stubs) ──────────────
// These were formerly in conventions/ and session/. Now defined locally
// in session-types.ts as the TS type declarations matching Rust/WASM.
export {
  ConventionCategory,
  SAYC_SYSTEM_CONFIG,
  AVAILABLE_BASE_SYSTEMS,
  getSystemConfig,
  createBiddingContext,
  OpponentMode,
  PracticeMode,
  PracticeRole,
  PlayPreference,
  PromptMode,
  DEFAULT_DRILL_TUNING,
  DEFAULT_DRILL_SETTINGS,
  PLAY_PROFILES,
  isValidTransition,
  resolveTransition,
  DEFAULT_PRACTICE_PREFERENCES,
  DEFAULT_DISPLAY_PREFERENCES,
  DEFAULT_BASE_MODULE_IDS,
  normalizePointFormula,
} from "./session-types";
export type {
  ConventionConfig,
  ConventionTeaching,
  BaseSystemId,
  SystemSelectionId,
  CustomSystem,
  CustomPracticePack,
  SystemConfig,
  PointFormula,
  PointConfig,
  TotalPointEquivalent,
  VulnerabilityDistribution,
  DrillSettings,
  PlayProfileId,
  GamePhase,
  ViewportNeeded,
  PhaseEvent,
  ServiceAction,
  TransitionDescriptor,
  TransitionResult,
  PlayEntryResult,
  PracticePreferences,
  DisplayPreferences,
  BiddingContext,
  EncoderKind,
  ConventionContribution,
  ParseTreeView,
  BidResult,
  PosteriorSummary,
  PosteriorFactValue,
  TeachingProjection,
  UserModule,
  UserModuleMetadata,
  UserModuleContent,
  ModuleCategory,
} from "./session-types";

// ── 5. Sync Service Helpers (for UI components) ─────────────────────
export { listConventions, listModules, buildBaseModuleInfos } from "./service-helpers";

// ── 6. Display & Formatting ─────────────────────────────────────────
export { displayConventionName, formatCall, formatContractWithDeclarer, formatRuleName, displayRank, formatCardLabel, SUIT_SYMBOLS, STRAIN_SYMBOLS } from "./display/format";
export { buildConventionCardPanel, buildAcblCardPanel } from "./display/convention-card";
export { slugifyMeaningId } from "./display/util/slugify-meaning-id";

// ── 7. Cross-cutting ────────────────────────────────────────────────
export { delay } from "./util/delay";

// ── 8. Auth & Billing (DataPort) ───────────────────────────────────
export { DataPortClient, DevDataPort, SubscriptionTier } from "./auth";
export type { DataPort, AuthUser } from "./auth";
export { AuthRequiredError, SubscriptionRequiredError } from "./billing";
export type { BillingPlan, DataPortBilling } from "./billing";

// ── Debug-only types — import from service/debug-types instead ──
// StrategyEvaluation, BidFeedbackDTO, EvaluatedFacts, PipelineResult, MachineDebugSnapshot
// are routed through debug-types.ts (not this barrel) to keep the production API surface clean.
