// ── Service module public API ────────────────────────────────────────

// ── 1. Service Port & Implementation ─────────────────────────────────
export type { DevServicePort } from "./port";
export { WasmService, initWasmService } from "./wasm-service";
export type { SessionHandle, SessionConfig } from "./request-types";

// ── 2. Viewports & Response Types (service-owned) ────────────────────
export {
  ServiceGamePhase,
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
  SingleCardResult,
  ServiceDerivedRanges,
  PlayRecommendation,
  HandEvaluationView,
  AuctionEntryView,
  ModuleCatalogEntry,
  ModuleLearningViewport,
  ModuleFlowTreeViewport,
  FlowTreeNode,
  ClauseSystemVariant,
  ServiceBidHistoryEntry as BidHistoryEntry,
  BaseModuleInfo,
  ConventionInfo,
  ServiceExplanationNode,
  BiddingOptionView,
  AcblCardSection,
  AcblCardPanelView,
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
} from "./session-types";
export type {
  ConventionConfig,
  ConventionTeaching,
  BaseSystemId,
  SystemConfig,
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
  PromptAcceptResult,
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
} from "./session-types";

// ── 5. Sync Service Helpers (for UI components) ─────────────────────
export { listConventions, listModules, buildBaseModuleInfos } from "./service-helpers";

// ── 6. Display & Formatting ─────────────────────────────────────────
export { displayConventionName, formatCall, formatContractWithDeclarer, formatRuleName, displayRank, formatCardLabel, SUIT_SYMBOLS, STRAIN_SYMBOLS } from "./display/format";
export { buildConventionCardPanel, buildAcblCardPanel } from "./display/convention-card";

// ── 7. Cross-cutting ────────────────────────────────────────────────
export { delay } from "./util/delay";

// ── Debug-only types — import from service/debug-types instead ──
// StrategyEvaluation, BidFeedbackDTO, EvaluatedFacts, PipelineResult, MachineDebugSnapshot
// are routed through debug-types.ts (not this barrel) to keep the production API surface clean.
