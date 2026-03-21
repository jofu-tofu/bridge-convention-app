// ── Viewport Public API ─────────────────────────────────────────────

// Types
export type {
  BiddingViewport,
  HandEvaluationView,
  AuctionEntryView,
  BiddingOptionView,
  ViewportBidFeedback,
  ViewportBidGrade,
  ConditionView,
  AlternativeView,
  NearMissView,
  ConventionView,
  TeachingDetail,
  DeclarerPromptViewport,
  PlayingViewport,
  ExplanationViewport,
} from "./player-viewport";

export type {
  EvaluationOracle,
  OracleGradingResult,
} from "./evaluation-oracle";

// Build functions
export {
  buildBiddingViewport,
  buildViewportFeedback,
  buildTeachingDetail,
  buildDeclarerPromptViewport,
  buildPlayingViewport,
  buildExplanationViewport,
} from "./build-viewport";

export type {
  BuildBiddingViewportInput,
  BuildDeclarerPromptViewportInput,
  BuildPlayingViewportInput,
  BuildExplanationViewportInput,
} from "./build-viewport";
