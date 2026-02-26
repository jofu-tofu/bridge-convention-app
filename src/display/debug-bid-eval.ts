import type { ConventionConfig } from "../conventions/core/types";
import type { Deal, Auction, Call, Seat } from "../engine/types";
import type { ConditionResult } from "../conventions/core/types";
import type { BidHistoryEntry } from "../stores/game.svelte";
import { evaluateAllBiddingRules } from "../conventions/core/registry";
import { reconstructBiddingContext } from "../conventions/core/debug-utils";

export interface BidEvalTrace {
  readonly entry: BidHistoryEntry;
  readonly allResults: readonly DebugRuleResultView[];
}

export interface DebugRuleResultView {
  readonly ruleName: string;
  readonly matched: boolean;
  readonly isLegal: boolean;
  readonly call?: Call;
  readonly conditionResults?: readonly ConditionResult[];
}

/** Compute full rule evaluation trace for each bid in history. */
export function computeBidEvalTraces(
  convention: ConventionConfig | null | undefined,
  deal: Deal | null,
  bidHistory: readonly BidHistoryEntry[],
  auctionEntries: readonly { seat: Seat; call: Call }[],
): BidEvalTrace[] {
  if (!convention || !deal) return [];

  return bidHistory.map((entry, i) => {
    const auctionPrefix: Auction = {
      entries: auctionEntries.slice(0, i) as { seat: Seat; call: Call }[],
      isComplete: false,
    };
    const ctx = reconstructBiddingContext(deal, entry.seat, auctionPrefix);
    const allResults = evaluateAllBiddingRules(ctx, convention);
    return { entry, allResults };
  });
}
