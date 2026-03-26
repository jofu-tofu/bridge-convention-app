// ── Service module public API ────────────────────────────────────────

// Port interfaces
export type { DevServicePort } from "./port";

// Boundary types — requests
export type {
  SessionHandle,
  SessionConfig,
} from "./request-types";

// Boundary types — responses
export type {
  ServiceGamePhase,
  ViewportBidGrade,
  ServicePublicBeliefs,
  ServicePublicBeliefState,
  ServiceInferenceSnapshot,
  AiBidEntry,
  AiPlayEntry,
  ConventionCardView,
} from "./response-types";

// Evaluation facade (CLI + stateless grading)

export { buildAtomViewport, gradeAtomBid, validateAtomId, parseAtomId } from "./evaluation/atom-evaluator";
export { startPlaythrough, getPlaythroughStepViewport, gradePlaythroughBid, getPlaythroughRevealSteps } from "./evaluation/playthrough-evaluator";

// Implementation
export { createLocalService } from "./local-service";

// Re-exported for store/CLI/component consumption
export type { PublicBeliefState, InferenceSnapshot } from "../inference/types";
export { createBiddingContext } from "../conventions";
export type { BidFeedbackDTO } from "../session/bid-feedback-builder";

export type { BiddingViewport, ViewportBidFeedback, TeachingDetail, DeclarerPromptViewport, PlayingViewport, ExplanationViewport, HandEvaluationView, AuctionEntryView } from "./response-types";

export type { ModuleCatalogEntry, ModuleLearningViewport, ClauseSystemVariant } from "./response-types";

// ── Engine domain primitives (universal vocabulary, acceptable to re-export) ──

// Engine types — enums (value + type)
export { Seat, Suit, Rank, BidSuit, Vulnerability } from "../engine/types";
// Engine types — type-only
export type { Call, Card, Hand, ContractBid, Contract, Auction, AuctionEntry, Trick, PlayedCard, DDSolution, Deal } from "../engine/types";
// Engine port
export type { EnginePort } from "../engine/port";
// Engine constants (display/layout concerns)
export { SEAT_INDEX, SUIT_ORDER, RANK_INDEX, SEATS, nextSeat, partnerSeat, areSamePartnership } from "../engine/constants";
// Engine display utilities (pure functions on API contract types)
export { callKey, callsMatch } from "../engine/call-helpers";
export { isVulnerable } from "../engine/scoring";
export { evaluateHand, calculateHcp } from "../engine/hand-evaluator";

// ── Convention system re-exports ──

export { ConventionCategory, getConvention, getModule, SAYC_SYSTEM_CONFIG, AVAILABLE_BASE_SYSTEMS, getSystemConfig, listConventions } from "../conventions";
export type { ConventionConfig, ConventionContribution, ParseTreeView, TeachingProjection, EncoderKind, BaseSystemId, SystemConfig } from "../conventions";

// ── Convention card ──
export { buildConventionCard } from "./display/convention-card";

// ── Strategy re-exports ──

export type { BidResult, BiddingContext, BiddingStrategy } from "../conventions";
export type { ServiceBidHistoryEntry as BidHistoryEntry } from "./response-types";
export type { PlayStrategy, PlayContext, PlayResult } from "../conventions";
export type { PosteriorSummary } from "../conventions";
export type { StrategyEvaluation } from "../conventions";

// ── Coverage utilities (for coverage screen) ──

export { listBundleInputs, resolveBundle, getBundleInput, enumerateRuleAtoms, generateRuleCoverageManifest } from "../conventions";
export type { RuleCoverageManifest, ConventionBundle } from "../conventions";

// ── Inference re-exports ──

export type { PosteriorFactValue } from "../inference/posterior/posterior-types";

// ── Bootstrap re-exports ──

export type { OpponentMode, VulnerabilityDistribution } from "../session/drill-types";
export type { DrillSettings } from "../session/drill-types";
export { DEFAULT_DRILL_TUNING, DEFAULT_DRILL_SETTINGS } from "../session/drill-types";
export type { PlayProfileId } from "../session/heuristics/play-profiles";
export { PLAY_PROFILES } from "../session/heuristics/play-profiles";

// ── Session phase machine (for store consumption) ──

export { isValidTransition } from "../session/phase-machine";
export type { GamePhase } from "../session/phase-machine";

// ── Practice preferences (for store consumption) ──

export type { PracticePreferences, DisplayPreferences } from "../session/practice-preferences";
export { DEFAULT_PRACTICE_PREFERENCES, DEFAULT_DISPLAY_PREFERENCES } from "../session/practice-preferences";

// ── Display formatting (UI-facing pure functions) ──

export { displayConventionName, formatCall, formatContractWithDeclarer, formatRuleName, displayRank, formatCardLabel, SUIT_SYMBOLS, STRAIN_SYMBOLS } from "./display/format";

// ── Utility re-exports ──

export { delay } from "./util/delay";

// ── Debug-only types — import from service/debug-types instead ──
// EvaluatedFacts, PipelineResult, MachineDebugSnapshot moved to debug-types.ts
