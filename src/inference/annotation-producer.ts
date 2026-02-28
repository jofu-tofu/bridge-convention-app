import type { AuctionEntry, Auction } from "../engine/types";
import type { BiddingRuleResult } from "../conventions/core/registry";
import type { BidAnnotation, InferenceExtractor, InferenceProvider } from "./types";

/**
 * Produce a BidAnnotation for a single auction entry.
 *
 * Convention bids: meaning/alert/inferences from the rule result + extractor.
 * Natural bids: inferences from the natural provider.
 * Pass/double/redouble: no inferences.
 */
export function produceAnnotation(
  entry: AuctionEntry,
  ruleResult: BiddingRuleResult | null,
  conventionId: string | null,
  extractor: InferenceExtractor,
  naturalProvider: InferenceProvider,
  auctionBefore: Auction,
): BidAnnotation {
  // Convention bid
  if (ruleResult) {
    return {
      call: entry.call,
      seat: entry.seat,
      ruleName: ruleResult.rule,
      conventionId,
      meaning: ruleResult.meaning ?? ruleResult.explanation,
      alert: ruleResult.alert ?? null,
      inferences: extractor.extractInferences(ruleResult, entry.seat),
    };
  }

  // Natural contract bid (not pass/double/redouble)
  if (entry.call.type === "bid") {
    const naturalInference = naturalProvider.inferFromBid(entry, auctionBefore, entry.seat);
    return {
      call: entry.call,
      seat: entry.seat,
      ruleName: null,
      conventionId: null,
      meaning: "Natural bid",
      alert: null,
      inferences: naturalInference ? [naturalInference] : [],
    };
  }

  // Pass / double / redouble
  const meaningMap: Record<string, string> = {
    pass: "Pass",
    double: "Double",
    redouble: "Redouble",
  };

  return {
    call: entry.call,
    seat: entry.seat,
    ruleName: null,
    conventionId: null,
    meaning: meaningMap[entry.call.type] ?? entry.call.type,
    alert: null,
    inferences: [],
  };
}
