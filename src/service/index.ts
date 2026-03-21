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
  AtomGradeResult,
  ServiceDebugSnapshot,
  ServiceDebugLogEntry,
  ServiceInferenceSnapshot,
} from "./response-types";

// Implementation
export { createLocalService } from "./local-service";

// Re-exported for store consumption (replaces direct internal imports)
export { createInferenceCoordinator } from "../inference/inference-coordinator";
export type { PublicBeliefState, InferenceSnapshot } from "../inference/types";
export { createBiddingContext } from "../conventions/core";
export { assembleBidFeedback } from "../bootstrap/bid-feedback-builder";
export type { BidFeedbackDTO } from "../bootstrap/bid-feedback-builder";
export { buildBiddingViewport, buildViewportFeedback, buildTeachingDetail, buildDeclarerPromptViewport, buildPlayingViewport, buildExplanationViewport } from "../core/viewport";
export type { BiddingViewport, ViewportBidFeedback, TeachingDetail, DeclarerPromptViewport, PlayingViewport, ExplanationViewport } from "../core/viewport";
export { randomPlayStrategy } from "../strategy/play/random-play";
export type { DrillSession, DrillBundle } from "../bootstrap/types";
