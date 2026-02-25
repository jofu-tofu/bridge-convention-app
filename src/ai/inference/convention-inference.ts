import type { InferenceProvider, HandInference, SuitInference } from "./types";
import type { Auction, AuctionEntry, Seat, Call } from "../../engine/types";
import type { Suit } from "../../engine/types";
import { getConvention, isTreeConvention } from "../../conventions/registry";
import { evaluateTree } from "../../conventions/tree-evaluator";
import { flattenTree, isAuctionCondition } from "../../conventions/tree-compat";
import { createBiddingContext } from "../../conventions/context-factory";
import { evaluateHand } from "../../engine/hand-evaluator";
import { isConditionedRule } from "../../conventions/condition-evaluator";
import type { ConditionedBiddingRule, BiddingContext } from "../../conventions/types";
import {
  extractInference,
  conditionToHandInference,
  invertInference,
  resolveDisjunction,
} from "./condition-mapper";

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
    return rule.call({} as BiddingContext);
  } catch {
    return null;
  }
}

/**
 * Create an inference provider that extracts hand information from convention rules.
 *
 * Strategy: For each bid in the auction, evaluate the convention's rule tree directly
 * for negative inference (rejected decisions), and match flat rules by call for positive
 * inference (from handConditions with .inference metadata).
 *
 * Architecture invariant: Inference calls evaluateTree() directly — never
 * evaluateBiddingRules() — because the registry strips rejectedDecisions needed
 * for negative inference. The TreeEvalResult shape (path, rejectedDecisions, visited)
 * is the inference engine's contract with the tree evaluator.
 */
export function createConventionInferenceProvider(
  conventionId: string,
): InferenceProvider {
  return {
    id: `convention:${conventionId}`,
    name: `Convention: ${conventionId}`,
    inferFromBid(
      entry: AuctionEntry,
      auctionBefore: Auction,
      seat: Seat,
    ): HandInference | null {
      let convention;
      try {
        convention = getConvention(conventionId);
      } catch {
        return null; // Convention not registered
      }

      if (!isTreeConvention(convention)) return null;

      const rules = flattenTree(convention.ruleTree);
      const handInferences: HandInference[] = [];
      let matchedRuleName: string | null = null;

      // Build auction context once — used for both positive filtering (V2) and tree eval
      const dummyHand = { cards: [] };
      const auctionContext = createBiddingContext({
        hand: dummyHand,
        auction: auctionBefore,
        seat,
        evaluation: evaluateHand(dummyHand),
      });

      // Positive inference: find the first rule whose call AND auction conditions
      // match the bid, then extract inferences from its handConditions
      for (const rule of rules) {
        if (!isConditionedRule(rule)) continue;
        const conditioned = rule as ConditionedBiddingRule;

        const ruleCall = tryGetRuleCall(conditioned);
        if (ruleCall && !callsMatch(ruleCall, entry.call)) continue;

        // V2: Also verify auction conditions match the current auction state
        const auctionMatch = conditioned.auctionConditions.every(
          (c) => c.test(auctionContext),
        );
        if (!auctionMatch) continue;

        matchedRuleName = conditioned.name;

        for (const condition of conditioned.handConditions) {
          const ci = extractInference(condition);
          if (ci) {
            const hi = conditionToHandInference(ci, seat, conditioned.name);
            if (hi) handInferences.push(hi);
          }
        }
        break;
      }

      if (!matchedRuleName) return null;

      // Negative inference: evaluate tree with auction context to get rejected decisions
      const treeResult = evaluateTree(convention.ruleTree, auctionContext);

      // Extract negative inferences from rejected auction-condition decisions only.
      // V1: Hand-condition rejections are unreliable because the dummy hand (empty cards)
      // causes all hand conditions to reject, producing false negatives.
      let cumulative: HandInference | null = handInferences.length > 0
        ? mergeHandInferences(handInferences, seat, matchedRuleName)
        : null;

      for (const rejected of treeResult.rejectedDecisions) {
        if (!isAuctionCondition(rejected.node.name)) continue;

        const ci = extractInference(rejected.node.condition);
        if (!ci) continue;

        const inverted = invertInference(ci);
        if (!inverted) continue;

        // V5: Flatten array/single into unified path
        const resolved = Array.isArray(inverted)
          ? resolveDisjunction(inverted, cumulative)
          : inverted;
        if (!resolved) continue;

        const hi = conditionToHandInference(resolved, seat, matchedRuleName);
        if (hi) {
          handInferences.push(hi);
          cumulative = mergeHandInferences(handInferences, seat, matchedRuleName);
        }
      }

      if (handInferences.length === 0) return null;

      return mergeHandInferences(handInferences, seat, matchedRuleName);
    },
  };
}

/** Merge multiple HandInference objects into one (range intersection). */
function mergeHandInferences(
  inferences: HandInference[],
  seat: Seat,
  source: string,
): HandInference {
  let minHcp: number | undefined;
  let maxHcp: number | undefined;
  let isBalanced: boolean | undefined;
  const suits: Partial<Record<Suit, { minLength?: number; maxLength?: number }>> = {};

  for (const inf of inferences) {
    if (inf.minHcp !== undefined) {
      minHcp = minHcp !== undefined ? Math.max(minHcp, inf.minHcp) : inf.minHcp;
    }
    if (inf.maxHcp !== undefined) {
      maxHcp = maxHcp !== undefined ? Math.min(maxHcp, inf.maxHcp) : inf.maxHcp;
    }
    if (inf.isBalanced !== undefined && isBalanced === undefined) isBalanced = inf.isBalanced;

    for (const [s, si] of Object.entries(inf.suits) as [Suit, SuitInference][]) {
      if (!suits[s]) suits[s] = {};
      if (si.minLength !== undefined) {
        suits[s]!.minLength = Math.max(suits[s]!.minLength ?? 0, si.minLength);
      }
      if (si.maxLength !== undefined) {
        suits[s]!.maxLength = Math.min(suits[s]!.maxLength ?? 13, si.maxLength);
      }
    }
  }

  return {
    seat,
    minHcp,
    maxHcp,
    isBalanced,
    suits: suits as Partial<Record<Suit, SuitInference>>,
    source,
  };
}
