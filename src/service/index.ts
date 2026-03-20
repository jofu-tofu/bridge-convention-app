// ── Service module public API ────────────────────────────────────────

// Port interfaces
export type { ServicePort, DevServicePort } from "./port";

// Boundary types
export type {
  SessionHandle,
  SessionConfig,
  DrillStartResult,
  BidSubmitResult,
  AiBidEntry,
  PhaseTransition,
  PromptAcceptResult,
  PlayCardResult,
  SessionViewport,
  DDSolutionResult,
  ConventionInfo,
  AtomGradeResult,
  ServiceDebugSnapshot,
  ServiceDebugLogEntry,
  ServiceInferenceSnapshot,
} from "./types";

// Implementation
export { createLocalService } from "./local-service";

// Re-exported for store consumption (replaces direct internal imports)
export { createInferenceCoordinator } from "../inference/inference-coordinator";
export type { InferenceCoordinator } from "../inference/inference-coordinator";
export type { PublicBeliefState, InferenceSnapshot } from "../inference/types";
export { createBiddingContext } from "../conventions/core";
export { assembleBidFeedback } from "../bootstrap/bid-feedback-builder";
export type { BidFeedbackDTO } from "../bootstrap/bid-feedback-builder";
export { buildBiddingViewport, buildViewportFeedback, buildTeachingDetail } from "../core/viewport";
export type { BiddingViewport, ViewportBidFeedback, TeachingDetail } from "../core/viewport";
export { randomPlayStrategy } from "../strategy/play/random-play";
export type { DrillSession, DrillBundle } from "../bootstrap/types";
export type { PublicBeliefs } from "../core/contracts";

// Phase machine (re-export for convenience)
export type { GamePhase } from "../stores/phase-machine";
export { isValidTransition, VALID_TRANSITIONS } from "../stores/phase-machine";
