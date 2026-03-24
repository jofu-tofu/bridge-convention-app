// ── Service module public API ────────────────────────────────────────

// Port interfaces
export type { ServicePort, DevServicePort } from "./port";

// Boundary types — requests
export type {
  SessionHandle,
  SessionConfig,
} from "./request-types";

// Boundary types — responses
export type {
  DrillStartResult,
  BidSubmitResult,
  AiBidEntry,
  PhaseTransition,
  PromptAcceptResult,
  PlayCardResult,
  AiPlayEntry,
  SessionViewport,
  DDSolutionResult,
  ConventionInfo,
  ServiceDebugSnapshot,
  ServiceDebugLogEntry,
  ServiceInferenceSnapshot,
} from "./response-types";

// Evaluation facade (CLI + stateless grading)
export type { AtomGradeResult, PlaythroughHandle, PlaythroughGradeResult, RevealStep } from "./evaluation/types";
export { buildAtomViewport, gradeAtomBid, validateAtomId, parseAtomId } from "./evaluation/atom-evaluator";
export { startPlaythrough, getPlaythroughStepViewport, gradePlaythroughBid, getPlaythroughRevealSteps } from "./evaluation/playthrough-evaluator";

// Implementation
export { createLocalService } from "./local-service";

// Re-exported for store consumption (replaces direct internal imports)
export { createInferenceCoordinator } from "../inference/inference-coordinator";
export type { PublicBeliefState, InferenceSnapshot } from "../inference/types";
export { createBiddingContext } from "../conventions";
export { assembleBidFeedback } from "../bootstrap/bid-feedback-builder";
export type { BidFeedbackDTO } from "../bootstrap/bid-feedback-builder";
export { buildBiddingViewport, buildViewportFeedback, buildTeachingDetail, buildDeclarerPromptViewport, buildPlayingViewport, buildExplanationViewport } from "./build-viewport";
export type { BuildBiddingViewportInput, BuildDeclarerPromptViewportInput, BuildPlayingViewportInput, BuildExplanationViewportInput } from "./build-viewport";
export type { BiddingViewport, ViewportBidFeedback, ViewportBidGrade, TeachingDetail, DeclarerPromptViewport, PlayingViewport, ExplanationViewport, HandEvaluationView, AuctionEntryView, BiddingOptionView, ConditionView, AlternativeView, NearMissView, ConventionView, LearningViewport, ModuleView, SurfaceView, ConstraintView } from "./response-types";
export type { EvaluationOracle, OracleGradingResult } from "./evaluation-oracle";
export { randomPlayStrategy } from "../strategy/play/random-play";
export type { DrillSession, DrillBundle } from "../bootstrap/types";

// ── Engine domain primitives (universal vocabulary, acceptable to re-export) ──

// Engine types — enums (value + type)
export { Seat, Suit, Rank, BidSuit, Vulnerability } from "../engine/types";
// Engine types — type-only
export type { Call, Card, Hand, ContractBid, Contract, AuctionEntry, Trick, PlayedCard, DDSolution, Deal, SuitLength, DistributionPoints } from "../engine/types";
// Engine port
export type { EnginePort } from "../engine/port";
// Engine constants (display/layout concerns)
export { SEAT_INDEX, SUIT_ORDER, RANK_INDEX, SEATS } from "../engine/constants";
// Engine display utilities (pure functions on API contract types)
export { callKey, callsMatch } from "../engine/call-helpers";
export { isVulnerable } from "../engine/scoring";
export { evaluateHand, calculateHcp } from "../engine/hand-evaluator";

// ── Convention system re-exports ──

export { ConventionCategory } from "../conventions/core/convention-types";
export type { ConventionConfig } from "../conventions/core/convention-types";
export type { ConventionContribution, ParseTreeView, TeachingProjection, CallProjection, MeaningView, WhyNotEntry } from "../conventions/teaching/teaching-types";
export type { EncoderKind } from "../conventions/pipeline/provenance";
export { SAYC_SYSTEM_CONFIG, AVAILABLE_BASE_SYSTEMS } from "../conventions/definitions/system-config";

// ── Strategy re-exports ──

export type { BidResult, BiddingContext, BidHistoryEntry } from "../strategy/bidding/bidding-types";
export type { PosteriorSummary } from "../strategy/recommendation-types";

// ── Inference re-exports ──

export type { PosteriorFactValue } from "../inference/posterior/posterior-types";

// ── Bootstrap re-exports ──

export type { OpponentMode, VulnerabilityDistribution } from "../bootstrap/drill-types";
export { DEFAULT_DRILL_TUNING } from "../bootstrap/drill-types";

// ── Debug-only re-exports (for debug drawer components) ──

export type { EvaluatedFacts } from "../conventions/core/fact-catalog";
export type { PipelineResult } from "../conventions/pipeline/pipeline-types";
export type { MachineDebugSnapshot } from "../conventions/pipeline/strategy-evaluation";
