import type { AuctionEntry, Auction } from "../engine/types";
import type { BidAnnotation, InferenceExtractor, InferenceExtractorInput, InferenceProvider } from "./types";
import type { FactConstraint } from "../conventions/core/agreement-module";
import { handInferenceToConstraints } from "./derive-beliefs";

/**
 * Produce a BidAnnotation for a single auction entry.
 *
 * Convention bids: constraints from the rule result alert + extractor.
 * Natural bids: constraints converted from the natural provider.
 * Pass/double/redouble: no constraints.
 */
export function produceAnnotation(
  entry: AuctionEntry,
  ruleResult: InferenceExtractorInput | null,
  conventionId: string | null,
  extractor: InferenceExtractor,
  naturalProvider: InferenceProvider,
  auctionBefore: Auction,
): BidAnnotation {
  // Convention bid
  if (ruleResult) {
    const extracted = extractor.extractConstraints(ruleResult, entry.seat);
    // When the convention extractor produces constraints, use them.
    // When it returns empty (e.g. noopExtractor), try to use the
    // constraints directly (already FactConstraint[]).
    // Only fall back to the natural provider when no constraints exist.
    if (extracted.length > 0) {
      return {
        call: entry.call,
        seat: entry.seat,
        conventionId,
        meaning: ruleResult.meaning ?? ruleResult.explanation,
        constraints: extracted,
      };
    }

    // Use constraints directly — no lossy conversion
    const alertConstraints: readonly FactConstraint[] = ruleResult.constraints ?? [];
    if (alertConstraints.length > 0) {
      return {
        call: entry.call,
        seat: entry.seat,
        conventionId,
        meaning: ruleResult.meaning ?? ruleResult.explanation,
        constraints: alertConstraints,
      };
    }

    // Fall through with convention metadata but natural constraints
    if (entry.call.type === "bid") {
      const naturalConstraints = inferNaturalConstraints(naturalProvider, entry, auctionBefore);
      return {
        call: entry.call,
        seat: entry.seat,
        conventionId,
        meaning: ruleResult.meaning ?? ruleResult.explanation,
        constraints: naturalConstraints,
      };
    }
    return {
      call: entry.call,
      seat: entry.seat,
      conventionId,
      meaning: ruleResult.meaning ?? ruleResult.explanation,
      constraints: [],
    };
  }

  // Natural contract bid (not pass/double/redouble)
  if (entry.call.type === "bid") {
    const naturalConstraints = inferNaturalConstraints(naturalProvider, entry, auctionBefore);
    return {
      call: entry.call,
      seat: entry.seat,
      conventionId: null,
      meaning: "Natural bid",
      constraints: naturalConstraints,
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
    conventionId: null,
    meaning: meaningMap[entry.call.type] ?? entry.call.type,
    constraints: [],
  };
}

/** Get constraints from natural provider, converting HandInference at the boundary. */
function inferNaturalConstraints(
  provider: InferenceProvider,
  entry: AuctionEntry,
  auctionBefore: Auction,
): readonly FactConstraint[] {
  const inference = provider.inferFromBid(entry, auctionBefore, entry.seat);
  return inference ? handInferenceToConstraints(inference) : [];
}
