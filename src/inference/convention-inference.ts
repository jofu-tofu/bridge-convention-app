import type { InferenceProvider, HandInference, SuitInference } from "./types";
import { Seat } from "../engine/types";
import type { Auction, AuctionEntry, Call } from "../engine/types";
import type { Suit } from "../engine/types";
import { callsMatch } from "../engine/call-helpers";
import { getConvention } from "../conventions/core/registry";
import {
  evaluateForInference,
  createBiddingContext,
  isAuctionCondition,
} from "../conventions/core/inference-api";
import { evaluateHand } from "../engine/hand-evaluator";
import type {
  BiddingContext,
  ConventionConfig,
  ConventionLookup,
} from "../conventions/core/types";
import type { InferenceRuleDTO } from "../conventions/core/inference-api";
import {
  extractInference,
  conditionToHandInference,
  invertInference,
  resolveDisjunction,
  shouldInvertCondition,
} from "./condition-mapper";

/**
 * Try to determine what call a rule produces by invoking it with a dummy context.
 * Returns null if the call function throws (dynamic rules that need real context).
 */
function tryGetRuleCall(rule: InferenceRuleDTO): Call | null {
  try {
    return rule.call({} as BiddingContext);
  } catch {
    return null;
  }
}

/**
 * Create an inference provider that extracts hand information from convention rules.
 *
 * Strategy: For each bid in the auction, use the core inference API for
 * both flattened rules (positive inference) and rejected decisions
 * (negative inference), then match calls + extract .inference metadata.
 */
export function createConventionInferenceProvider(
  conventionId: string,
  lookupConvention?: ConventionLookup,
): InferenceProvider & { cachedRules: readonly InferenceRuleDTO[] | null } {
  const lookup = lookupConvention ?? getConvention;

  const resolveConvention = (): ConventionConfig | null => {
    if (lookupConvention) {
      return lookup(conventionId);
    }
    try {
      return lookup(conventionId);
    } catch {
      return null;
    }
  };

  // Cache flattened rules at creation time — static per convention, avoids
  // recursive tree walk + array allocation on every inferFromBid call.
  let cachedRules: readonly InferenceRuleDTO[] | null = null;

  function getRules(): readonly InferenceRuleDTO[] | null {
    if (cachedRules) return cachedRules;
    const convention = resolveConvention();
    if (!convention) return null;
    const emptyHand = { cards: [] };
    const bootstrapContext = createBiddingContext({
      hand: emptyHand,
      auction: { entries: [], isComplete: false },
      seat: Seat.South,
      evaluation: evaluateHand(emptyHand),
      opponentConventionIds: [],
    });
    const inferenceData = evaluateForInference(convention, bootstrapContext);
    if (!inferenceData) return null;

    cachedRules = inferenceData.rules;
    return cachedRules;
  }

  return {
    id: `convention:${conventionId}`,
    name: `Convention: ${conventionId}`,
    get cachedRules() {
      return cachedRules;
    },
    inferFromBid(
      entry: AuctionEntry,
      auctionBefore: Auction,
      seat: Seat,
    ): HandInference | null {
      const rules = getRules();
      if (!rules) return null;

      const convention = resolveConvention();
      if (!convention) return null;
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
      const inferenceData = evaluateForInference(convention, auctionContext);
      if (!inferenceData) return null;

      // Positive inference: find the first rule whose call AND auction conditions
      // match the bid, then extract inferences from its handConditions
      for (const rule of rules) {
        const ruleCall = tryGetRuleCall(rule);
        if (ruleCall && !callsMatch(ruleCall, entry.call)) continue;

        // V2: Also verify auction conditions match the current auction state
        const auctionMatch = rule.auctionConditions.every(
          (c) => c.test(auctionContext),
        );
        if (!auctionMatch) continue;

        matchedRuleName = rule.name;

        for (const condition of rule.handConditions) {
          const ci = extractInference(condition);
          if (ci) {
            const hi = conditionToHandInference(ci, seat, rule.name);
            if (hi) handInferences.push(hi);
          }
        }
        break;
      }

      if (!matchedRuleName) return null;

      // Negative inference: evaluate tree with auction context to get rejected decisions
      // Extract negative inferences from rejected auction-condition decisions only.
      // V1: Hand-condition rejections are unreliable because the dummy hand (empty cards)
      // causes all hand conditions to reject, producing false negatives.
      let cumulative: HandInference | null = handInferences.length > 0
        ? mergeHandInferences(handInferences, seat, matchedRuleName)
        : null;

      for (const rejected of inferenceData.treeResult.rejectedDecisions) {
        if (!isAuctionCondition(rejected.node.condition)) continue;
        if (!shouldInvertCondition(rejected.node.condition)) continue;

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
