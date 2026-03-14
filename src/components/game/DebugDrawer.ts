import type { ConventionConfig } from "../../conventions/core";
import type { Call, Seat } from "../../engine/types";
import type { BidHistoryEntry } from "../../core/contracts";

export interface BidEvalTrace {
  readonly entry: BidHistoryEntry;
  readonly allResults: readonly DebugRuleResultView[];
}

export interface DebugRuleResultView {
  readonly ruleName: string;
  readonly matched: boolean;
  readonly isLegal: boolean;
  readonly call?: Call;
}

/** Compute full rule evaluation trace for each bid in history.
 *  Returns empty — old tree pipeline evaluators have been removed. */
export function computeBidEvalTraces(
  _convention: ConventionConfig | null | undefined,
  _deal: unknown,
  _bidHistory: readonly BidHistoryEntry[],
  _auctionEntries: readonly { seat: Seat; call: Call }[],
): BidEvalTrace[] {
  return [];
}
