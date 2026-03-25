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
  ServiceGamePhase,
  ViewportBidGrade,
  ServiceEncoderKind,
  ServiceExplanationNode,
  ServiceWhyNotEntry,
  ServiceConventionContribution,
  ServiceConditionEvidence,
  ServiceMeaningView,
  ServiceCallProjection,
  ServiceParseTreeView,
  ServiceParseTreeModuleNode,
  ServiceParseTreeCondition,
  ServiceBidHistoryEntry,
  ServiceFactConstraint,
  ServicePublicBeliefs,
  ServicePublicBeliefState,
  ServiceBidAnnotation,
  ServiceInferenceSnapshot,
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
  ConventionCardView,
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
export { assembleBidFeedback } from "../session/bid-feedback-builder";
export type { BidFeedbackDTO } from "../session/bid-feedback-builder";
export { buildBiddingViewport, buildViewportFeedback, buildTeachingDetail } from "../session/build-viewport";
export type { BuildBiddingViewportInput, BuildDeclarerPromptViewportInput, BuildPlayingViewportInput, BuildExplanationViewportInput } from "../session/build-viewport";
export type { BiddingViewport, ViewportBidFeedback, TeachingDetail, DeclarerPromptViewport, PlayingViewport, ExplanationViewport, HandEvaluationView, AuctionEntryView, BiddingOptionView, ConditionView, AlternativeView, NearMissView, ConventionView } from "./response-types";
export type { ServiceDebugSnapshot, ServiceDebugLogEntry, DebugSnapshotBase } from "./debug-types";
export type { ModuleCatalogEntry, ModuleLearningViewport, PhaseGroupView, SurfaceDetailView, SurfaceClauseView } from "./response-types";
export { buildModuleCatalog, buildModuleLearningViewport } from "../session/learning-viewport";
export type { EvaluationOracle, OracleGradingResult } from "../session/evaluation-oracle";
export { randomPlayStrategy } from "../session/heuristics/random-play";
export type { DrillSession, DrillBundle } from "../session/drill-types";

// ── Engine domain primitives (universal vocabulary, acceptable to re-export) ──

// Engine types — enums (value + type)
export { Seat, Suit, Rank, BidSuit, Vulnerability } from "../engine/types";
// Engine types — type-only
export type { Call, Card, Hand, ContractBid, Contract, AuctionEntry, Trick, PlayedCard, DDSolution, Deal, SuitLength, DistributionPoints } from "../engine/types";
// Engine port
export type { EnginePort } from "../engine/port";
// Engine constants (display/layout concerns)
export { SEAT_INDEX, SUIT_ORDER, RANK_INDEX, SEATS, nextSeat, partnerSeat, areSamePartnership } from "../engine/constants";
// Engine display utilities (pure functions on API contract types)
export { callKey, callsMatch } from "../engine/call-helpers";
export { isVulnerable } from "../engine/scoring";
export { evaluateHand, calculateHcp } from "../engine/hand-evaluator";

// ── Convention system re-exports ──

export { ConventionCategory, getConvention, getModule, SAYC_SYSTEM_CONFIG, AVAILABLE_BASE_SYSTEMS, getSystemConfig } from "../conventions";
export type { ConventionConfig, ConventionContribution, ParseTreeView, TeachingProjection, CallProjection, MeaningView, WhyNotEntry, EncoderKind, BaseSystemId, SystemConfig } from "../conventions";

// ── Convention card ──
export { buildConventionCard } from "./display/convention-card";

// ── Strategy re-exports ──

export type { BidResult, BiddingContext, BidHistoryEntry, BiddingStrategy } from "../conventions";
export type { PlayStrategy, PlayContext, PlayResult } from "../conventions";
export type { PosteriorSummary } from "../conventions";

// ── Inference re-exports ──

export type { PosteriorFactValue } from "../inference/posterior/posterior-types";

// ── Bootstrap re-exports ──

export type { OpponentMode, VulnerabilityDistribution } from "../session/drill-types";
export { DEFAULT_DRILL_TUNING } from "../session/drill-types";
export type { PlayProfileId } from "../session/heuristics/play-profiles";
export { PLAY_PROFILES } from "../session/heuristics/play-profiles";

// ── Debug-only types — import from service/debug-types instead ──
// EvaluatedFacts, PipelineResult, MachineDebugSnapshot moved to debug-types.ts
