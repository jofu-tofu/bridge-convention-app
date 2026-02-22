import type { InferenceProvider, HandInference, SuitInference } from "./types";
import type { Auction, AuctionEntry, Seat, Call } from "../../engine/types";
import type { Suit } from "../../engine/types";
import { getConvention } from "../../conventions/registry";
import { isConditionedRule } from "../../conventions/condition-evaluator";
import type { ConditionedBiddingRule, BiddingContext } from "../../conventions/types";
import { extractInference, conditionToHandInference } from "./condition-mapper";

/** Check if two calls match (same type, level, and strain for contract bids). */
function callsMatch(a: Call, b: Call): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "bid" && b.type === "bid") {
    return a.level === b.level && a.strain === b.strain;
  }
  return true; // pass === pass, double === double, etc.
}

/**
 * Try to determine what call a rule produces by invoking it with a dummy context.
 * Returns null if the call function throws (dynamic rules that need real context).
 */
function tryGetRuleCall(rule: ConditionedBiddingRule): Call | null {
  try {
    // Minimal dummy context — static call functions ignore it
    return rule.call({} as BiddingContext);
  } catch {
    return null; // Dynamic call function that accesses context properties
  }
}

/**
 * Create an inference provider that extracts hand information from convention rules.
 *
 * Strategy: For each bid in the auction, find matching convention rules
 * (those whose call output matches the bid) and extract inference data
 * from conditions that have structured `.inference` fields.
 */
export function createConventionInferenceProvider(
  conventionId: string,
): InferenceProvider {
  return {
    id: `convention:${conventionId}`,
    name: `Convention: ${conventionId}`,
    inferFromBid(
      entry: AuctionEntry,
      _auctionBefore: Auction,
      seat: Seat,
    ): HandInference | null {
      let convention;
      try {
        convention = getConvention(conventionId);
      } catch {
        return null; // Convention not registered
      }

      for (const rule of convention.biddingRules) {
        if (!isConditionedRule(rule)) continue;
        const conditioned = rule as ConditionedBiddingRule;

        // Only extract inferences from rules whose call matches the actual bid
        const ruleCall = tryGetRuleCall(conditioned);
        if (ruleCall && !callsMatch(ruleCall, entry.call)) continue;

        // Extract hand-related inferences from all conditions
        const handInferences: HandInference[] = [];
        for (const condition of conditioned.conditions) {
          const ci = extractInference(condition);
          if (ci) {
            const hi = conditionToHandInference(ci, seat, conditioned.name);
            if (hi) handInferences.push(hi);
          }
        }

        if (handInferences.length === 0) continue;

        // Merge all condition inferences for this rule into one HandInference
        let minHcp: number | undefined;
        let maxHcp: number | undefined;
        let isBalanced: boolean | undefined;
        const suits: Partial<
          Record<Suit, { minLength?: number; maxLength?: number }>
        > = {};

        for (const inf of handInferences) {
          if (inf.minHcp !== undefined) {
            minHcp =
              minHcp !== undefined
                ? Math.max(minHcp, inf.minHcp)
                : inf.minHcp;
          }
          if (inf.maxHcp !== undefined) {
            maxHcp =
              maxHcp !== undefined
                ? Math.min(maxHcp, inf.maxHcp)
                : inf.maxHcp;
          }
          if (inf.isBalanced !== undefined) isBalanced = inf.isBalanced;

          for (const [s, si] of Object.entries(inf.suits) as [
            Suit,
            SuitInference,
          ][]) {
            if (!suits[s]) suits[s] = {};
            if (si.minLength !== undefined) {
              suits[s]!.minLength = Math.max(
                suits[s]!.minLength ?? 0,
                si.minLength,
              );
            }
            if (si.maxLength !== undefined) {
              suits[s]!.maxLength = Math.min(
                suits[s]!.maxLength ?? 13,
                si.maxLength,
              );
            }
          }
        }

        return {
          seat,
          minHcp,
          maxHcp,
          isBalanced,
          suits: suits as Partial<Record<Suit, SuitInference>>,
          source: conditioned.name,
        };
      }

      return null;
    },
  };
}
