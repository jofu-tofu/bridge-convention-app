import type { Call } from "../engine/types";
import type { BiddingContext } from "../conventions/types";

/**
 * Plain DTO for condition evaluation results crossing the conventions/ → ai/ → store → UI boundary.
 * CONSTRAINT: Must remain a plain DTO — no methods, no imports from conventions/ or engine/.
 * This preserves the shared/ ↔ conventions/ dependency boundary.
 */
export interface ConditionDetail {
  readonly name: string;
  readonly passed: boolean;
  readonly description: string;
  /** For compound conditions (or/and): sub-condition details per branch. */
  readonly children?: readonly ConditionDetail[];
  /** For branches within an or(): true if this is the best-matching branch
   *  (most passing sub-conditions; first wins ties). */
  readonly isBestBranch?: boolean;
}

export interface BidResult {
  readonly call: Call;
  readonly ruleName: string | null;
  readonly explanation: string;
  readonly confidence?: number; // 0-1, future use (ML strategies)
  readonly conditions?: readonly ConditionDetail[];
}

export interface BiddingStrategy {
  readonly id: string;
  readonly name: string;
  suggest(context: BiddingContext): BidResult | null;
}
