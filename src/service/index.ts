// ── Service module public API ────────────────────────────────────────

// ── 1. Service Port & Implementation ─────────────────────────────────
export type { DevServicePort } from "./port";
export { createLocalService } from "./local-service";
export type { SessionHandle, SessionConfig } from "./request-types";

// ── 2. Viewports & Response Types (service-owned) ────────────────────
export type {
  ServiceGamePhase,
  ViewportBidGrade,
  ServicePublicBeliefs,
  ServicePublicBeliefState,
  ServiceInferenceSnapshot,
  ConventionCardView,
  BiddingViewport,
  ViewportBidFeedback,
  TeachingDetail,
  DeclarerPromptViewport,
  PlayingViewport,
  ExplanationViewport,
  PlayRecommendation,
  HandEvaluationView,
  AuctionEntryView,
  ModuleCatalogEntry,
  ModuleLearningViewport,
  FlowTreeNode,
  BundleFlowTreeViewport,
  ClauseSystemVariant,
  ServiceBidHistoryEntry as BidHistoryEntry,
} from "./response-types";

// ── 3. Game Vocabulary (engine primitives) ───────────────────────────
export { Seat, Suit, Rank, BidSuit, Vulnerability } from "../engine/types";
export type { Call, Card, Hand, ContractBid, Contract, Auction, AuctionEntry, Trick, PlayedCard, DDSolution, Deal } from "../engine/types";
export type { EnginePort } from "../engine/port";
export { SEAT_INDEX, SUIT_ORDER, RANK_INDEX, SEATS, nextSeat, partnerSeat, areSamePartnership } from "../engine/constants";
export { callKey, callsMatch } from "../engine/call-helpers";
export { isVulnerable } from "../engine/scoring";
export { evaluateHand, calculateHcp } from "../engine/hand-evaluator";

// ── 4. Convention Catalog & Strategy ─────────────────────────────────
export { ConventionCategory, getConvention, getModule, listConventions } from "../conventions";
export { SAYC_SYSTEM_CONFIG, AVAILABLE_BASE_SYSTEMS, getSystemConfig } from "../conventions";
export type { ConventionConfig, ConventionContribution, ParseTreeView, TeachingProjection, EncoderKind, BaseSystemId, SystemConfig } from "../conventions";
export { createBiddingContext } from "../conventions";
export type { BidResult, BiddingContext } from "../conventions";
export type { PlayStrategy, PlayContext, PlayResult, PosteriorSummary } from "../conventions";

// ── 5. Coverage Utilities ────────────────────────────────────────────
export { listBundleInputs, resolveBundle, getBundleInput, enumerateRuleAtoms, generateRuleCoverageManifest } from "../conventions";
export type { RuleCoverageManifest, ConventionBundle } from "../conventions";

// ── 6. Session Configuration ─────────────────────────────────────────
export type { OpponentMode, VulnerabilityDistribution, DrillSettings } from "../session";
export { DEFAULT_DRILL_TUNING, DEFAULT_DRILL_SETTINGS } from "../session";
export type { PlayProfileId } from "../session";
export { PLAY_PROFILES } from "../session";
export { isValidTransition } from "../session";
export type { GamePhase } from "../session";
export type { PracticePreferences, DisplayPreferences } from "../session";
export { DEFAULT_PRACTICE_PREFERENCES, DEFAULT_DISPLAY_PREFERENCES } from "../session";

// ── 7. Display & Formatting ─────────────────────────────────────────
export { displayConventionName, formatCall, formatContractWithDeclarer, formatRuleName, displayRank, formatCardLabel, formatBidReferences, SUIT_SYMBOLS, STRAIN_SYMBOLS } from "./display/format";
export { buildConventionCard } from "./display/convention-card";

// ── 8. Evaluation Facade (CLI grading) ──────────────────────────────
export { buildAtomViewport, gradeAtomBid, validateAtomId, parseAtomId } from "./evaluation/atom-evaluator";
export { startPlaythrough, getPlaythroughStepViewport, gradePlaythroughBid, getPlaythroughRevealSteps } from "./evaluation/playthrough-evaluator";

// ── 9. Cross-cutting ────────────────────────────────────────────────
export type { PosteriorFactValue } from "../inference/posterior/posterior-types";
export { delay } from "./util/delay";

// ── Debug-only types — import from service/debug-types instead ──
// StrategyEvaluation, BidFeedbackDTO, EvaluatedFacts, PipelineResult, MachineDebugSnapshot
// are routed through debug-types.ts (not this barrel) to keep the production API surface clean.
