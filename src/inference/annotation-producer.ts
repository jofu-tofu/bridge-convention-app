import type { AuctionEntry, Auction, Seat, Suit } from "../engine/types";
import type { BidAnnotation, InferenceExtractor, InferenceExtractorInput, InferenceProvider } from "./types";
import type { HandInference, SuitInference } from "../core/contracts";
import type { FactConstraintIR } from "../core/contracts";

/** Map factId suffix → engine Suit value for suit-length constraints. */
const SUIT_MAP: Record<string, Suit> = {
  spades: "S" as Suit,
  hearts: "H" as Suit,
  diamonds: "D" as Suit,
  clubs: "C" as Suit,
};

/** Convert structured publicConstraints (FactConstraintIR[]) to a HandInference.
 *  Handles direct HCP and suit-length constraints. Skips computed facts
 *  (e.g., bridge.hasFourCardMajor) that don't map to primitive ranges. */
function constraintsToInference(
  constraints: readonly FactConstraintIR[],
  seat: Seat,
  source: string,
): HandInference | null {
  let minHcp: number | undefined;
  let maxHcp: number | undefined;
  const suits: Partial<Record<Suit, SuitInference>> = {};
  let extracted = false;

  for (const c of constraints) {
    // HCP constraints: hand.hcp
    if (c.factId === "hand.hcp") {
      if (c.operator === "gte" && typeof c.value === "number") {
        minHcp = c.value;
        extracted = true;
      } else if (c.operator === "lte" && typeof c.value === "number") {
        maxHcp = c.value;
        extracted = true;
      } else if (c.operator === "range" && typeof c.value === "object" && c.value !== null && "min" in c.value) {
        const range = c.value as { min: number; max: number };
        minHcp = range.min;
        maxHcp = range.max;
        extracted = true;
      }
      continue;
    }

    // Suit length constraints: hand.suitLength.{suit}
    const suitMatch = c.factId.match(/^hand\.suitLength\.(\w+)$/);
    if (suitMatch) {
      const suitKey = SUIT_MAP[suitMatch[1]!];
      if (!suitKey) continue;
      const existing = suits[suitKey] ?? {};
      if (c.operator === "gte" && typeof c.value === "number") {
        suits[suitKey] = { ...existing, minLength: c.value };
        extracted = true;
      } else if (c.operator === "lte" && typeof c.value === "number") {
        suits[suitKey] = { ...existing, maxLength: c.value };
        extracted = true;
      }
    }
  }

  if (!extracted) return null;
  return { seat, minHcp, maxHcp, suits, source };
}

/**
 * Produce a BidAnnotation for a single auction entry.
 *
 * Convention bids: meaning/alert/inferences from the rule result + extractor.
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
): BidAnnotation {
  // Convention bid
  if (ruleResult) {
    const inferences = extractor.extractInferences(ruleResult, entry.seat);
    // When the convention extractor produces inferences, use them.
    // When it returns empty (e.g. noopExtractor), try to derive inferences
    // from the alert's publicConstraints (formal convention rules).
    // Only fall back to the natural provider when no alert constraints exist.
    if (inferences.length > 0) {
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

    // Try to derive inferences from alert's publicConstraints
    const alertInference = ruleResult.alert?.publicConstraints?.length
      ? constraintsToInference(
          ruleResult.alert.publicConstraints,
          entry.seat,
          `alert:${ruleResult.rule}`,
        )
      : null;

    if (alertInference) {
      return {
        call: entry.call,
        seat: entry.seat,
        ruleName: ruleResult.rule,
        conventionId,
        meaning: ruleResult.meaning ?? ruleResult.explanation,
        alert: ruleResult.alert ?? null,
        inferences: [alertInference],
      };
    }

    // Fall through with convention metadata but natural inferences
    if (entry.call.type === "bid") {
      const naturalInference = naturalProvider.inferFromBid(entry, auctionBefore, entry.seat);
      return {
        call: entry.call,
        seat: entry.seat,
        ruleName: ruleResult.rule,
        conventionId,
        meaning: ruleResult.meaning ?? ruleResult.explanation,
        alert: ruleResult.alert ?? null,
        inferences: naturalInference ? [naturalInference] : [],
      };
    }
    return {
      call: entry.call,
      seat: entry.seat,
      ruleName: ruleResult.rule,
      conventionId,
      meaning: ruleResult.meaning ?? ruleResult.explanation,
      alert: ruleResult.alert ?? null,
      inferences: [],
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
