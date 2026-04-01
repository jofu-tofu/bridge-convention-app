import type { ViewportBidFeedback, TeachingDetail, HandEvaluationView, BiddingOptionView } from "../../../service";

/**
 * Base props shared by all bid feedback variants (Correct, Acceptable, NearMiss, Incorrect).
 * BidFeedbackPanel computes practicalRec and showPracticalNote from its own props,
 * then forwards this uniform shape to whichever variant it selects.
 */
export interface BidFeedbackBaseProps {
  feedback: ViewportBidFeedback;
  teaching: TeachingDetail | null;
  practicalRec: TeachingDetail["practicalRecommendation"];
  showPracticalNote: boolean;
  handEval: HandEvaluationView | null;
  handSummary: string | null;
  biddingOptions: readonly BiddingOptionView[];
}

/**
 * Extended props for interactive variants (Incorrect, NearMiss) that allow retrying.
 */
export interface BidFeedbackInteractiveProps extends BidFeedbackBaseProps {
  onRetry: () => void;
}
