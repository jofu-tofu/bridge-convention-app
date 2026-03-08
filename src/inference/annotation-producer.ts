import type { AuctionEntry, Auction } from "../engine/types";
import type { TreeInferenceData } from "../core/contracts";
import type { BidAnnotation, InferenceExtractor, InferenceExtractorInput, InferenceProvider } from "./types";
import { extractInferencesFromDTO } from "./tree-inference-extractor";

/**
 * Produce a BidAnnotation for a single auction entry.
 *
 * Convention bids: meaning/alert/inferences from the rule result + extractor.
 * When treeInferenceData is provided, extracts inferences directly from the DTO
 * (bypasses the hollow BiddingRuleResult adapter that returns empty inferences).
 * Natural bids: inferences from the natural provider.
 * Pass/double/redouble: no inferences.
 */
export function produceAnnotation(
  entry: AuctionEntry,
  ruleResult: InferenceExtractorInput | null,
  conventionId: string | null,
  extractor: InferenceExtractor,
  naturalProvider: InferenceProvider,
  auctionBefore: Auction,
  treeInferenceData?: TreeInferenceData,
): BidAnnotation {
  // Convention bid
  if (ruleResult) {
    // Prefer DTO-based extraction when available (avoids hollow adapter problem)
    const inferences = treeInferenceData
      ? extractInferencesFromDTO(treeInferenceData, entry.seat, ruleResult.rule ?? "convention")
      : extractor.extractInferences(ruleResult, entry.seat);
    return {
      call: entry.call,
      seat: entry.seat,
      ruleName: ruleResult.rule,
      conventionId,
      meaning: ruleResult.meaning ?? ruleResult.explanation,
      alert: ruleResult.alert ?? null,
      inferences,
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
