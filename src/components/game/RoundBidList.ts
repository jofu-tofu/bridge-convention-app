import type {
  BidHistoryEntry,
  HandEvaluationView,
  ReviewCondition,
  ServiceExplanationNode,
} from "../../service";
import { ViewportBidGrade } from "../../service";

import { enrichConditionText } from "./bid-feedback/BidFeedbackPanel";
import type { FeedbackVariant } from "./bid-feedback/BidFeedbackPanel";

// ─── Round-by-round grouping ──────────────────────────────────

interface RoundGroup {
  readonly roundNumber: number;
  readonly entries: readonly BidHistoryEntry[];
}

/**
 * Group bid history entries into rounds of 4 (one full table rotation).
 * Every 4 consecutive bids form a round, regardless of dealer position.
 */
export function groupBidsByRound(
  bidHistory: readonly BidHistoryEntry[],
): RoundGroup[] {
  if (bidHistory.length === 0) return [];

  const groups: RoundGroup[] = [];
  for (let i = 0; i < bidHistory.length; i += 4) {
    groups.push({
      roundNumber: Math.floor(i / 4) + 1,
      entries: bidHistory.slice(i, i + 4),
    });
  }
  return groups;
}

export function gradeBadgeConfig(
  grade?: ViewportBidGrade,
): { label: string; colorClass: string } | null {
  switch (grade) {
    case ViewportBidGrade.Correct:
      return {
        label: "OK",
        colorClass:
          "border border-emerald-500/35 bg-emerald-500/15 text-emerald-200",
      };
    case ViewportBidGrade.Acceptable:
      return {
        label: "OK",
        colorClass: "border border-teal-500/35 bg-teal-500/15 text-teal-200",
      };
    case ViewportBidGrade.NearMiss:
      return {
        label: "Close",
        colorClass: "border border-amber-500/35 bg-amber-500/15 text-amber-200",
      };
    case ViewportBidGrade.Incorrect:
      return {
        label: "Wrong",
        colorClass: "border border-red-500/35 bg-red-500/15 text-red-200",
      };
    default:
      return null;
  }
}

export function detailVariantForGrade(
  grade?: ViewportBidGrade,
): FeedbackVariant | null {
  switch (grade) {
    case ViewportBidGrade.NearMiss:
      return "near-miss";
    case ViewportBidGrade.Incorrect:
      return "incorrect";
    default:
      return null;
  }
}

export function formatReviewConditionText(
  condition: ReviewCondition,
  handEvaluation?: HandEvaluationView,
): string {
  const explanationNode: ServiceExplanationNode = {
    kind: "condition",
    content: condition.description,
    passed: condition.passed,
    explanationId: condition.explanationId,
  };

  if (handEvaluation) {
    return enrichConditionText(explanationNode, handEvaluation);
  }
  if (condition.observedValue) {
    return `${condition.description} (you have ${condition.observedValue})`;
  }
  return condition.description;
}
