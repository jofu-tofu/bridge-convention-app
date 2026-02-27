import type {
  ConventionConfig,
} from "../conventions/core/types";
import type { BidHistoryEntry } from "../shared/types";
import type { BidResult, ConditionDetail, TreeEvalSummary } from "../shared/types";
import type { Deal, Call, Seat, Auction } from "../engine/types";
import { Seat as SeatEnum } from "../engine/types";
import {
  isConditionedRule,
  evaluateConditions,
} from "../conventions/core/condition-evaluator";
import { evaluateHand } from "../engine/hand-evaluator";
import { createBiddingContext } from "../conventions/core/context-factory";
import { getEffectiveRules } from "../conventions/core/registry";
import { formatRuleName } from "./format";

export interface DisplayCondition {
  readonly name: string;
  readonly passed: boolean;
  readonly description: string;
}

export interface DisplayRule {
  readonly ruleName: string;
  readonly displayName: string;
  readonly call: Call | undefined;
  readonly fired: boolean;
  readonly firedBySeat: Seat | null;
  readonly conditions: DisplayCondition[];
  readonly isConditioned: boolean;
}

/**
 * Prepare convention rules for display in the Rules tab.
 * Splits rules into fired (matched bidHistory entries) and reference (remaining).
 * Fired rules get context-aware condition evaluation with real hand data.
 * Reference rules get static condition labels only.
 */
export function prepareRulesForDisplay(
  config: ConventionConfig,
  deal: Deal,
  bidHistory: readonly BidHistoryEntry[],
): { firedRules: DisplayRule[]; referenceRules: DisplayRule[] } {
  const rules = getEffectiveRules(config);
  // Build map: ruleName → first bidHistory entry that used it (with index for ordering)
  const firedMap = new Map<
    string,
    { entry: BidHistoryEntry; index: number }
  >();
  for (let i = 0; i < bidHistory.length; i++) {
    const entry = bidHistory[i]!;
    if (entry.ruleName && !firedMap.has(entry.ruleName)) {
      firedMap.set(entry.ruleName, { entry, index: i });
    }
  }

  const firedRules: Array<{ rule: DisplayRule; index: number }> = [];
  const referenceRules: DisplayRule[] = [];

  for (const rule of rules) {
    const firedInfo = firedMap.get(rule.name);

    if (firedInfo) {
      // Build BiddingContext from the firing seat's hand + auction state at that point
      const { entry, index } = firedInfo;
      const hand = deal.hands[entry.seat];
      const evaluation = evaluateHand(hand);

      // Reconstruct auction state at the point this bid was made
      const auctionEntries = bidHistory.slice(0, index).map((b) => ({
        seat: b.seat,
        call: b.call,
      }));
      const auction = { entries: auctionEntries, isComplete: false };

      const context = createBiddingContext({
        hand,
        auction,
        seat: entry.seat,
        evaluation,
      });

      const conditions: DisplayCondition[] = isConditionedRule(rule)
        ? evaluateConditions(rule, context).map((r) => ({
            name: r.condition.name,
            passed: r.passed,
            description: r.description,
          }))
        : [
            {
              name: rule.explanation,
              passed: true,
              description: rule.explanation,
            },
          ];

      firedRules.push({
        rule: {
          ruleName: rule.name,
          displayName: formatRuleName(rule.name),
          call: entry.call.type === "bid" ? entry.call : undefined,
          fired: true,
          firedBySeat: entry.seat,
          conditions,
          isConditioned: isConditionedRule(rule),
        },
        index,
      });
    } else {
      // Reference rule — static condition labels
      const conditions: DisplayCondition[] = isConditionedRule(rule)
        ? [
            ...rule.auctionConditions.map((c) => ({
              name: c.name,
              passed: false,
              description: c.label,
            })),
            ...rule.handConditions.map((c) => ({
              name: c.name,
              passed: false,
              description: c.label,
            })),
          ]
        : [
            {
              name: rule.explanation,
              passed: false,
              description: rule.explanation,
            },
          ];

      // Compute what call this rule would produce for badge display.
      // Contract: rule.call() must return a valid Call even with a minimal context.
      // This works because conditioned rules return static calls; if a future rule
      // computes calls dynamically from auction state, it must handle empty auctions.
      let referenceCall: Call | undefined;
      try {
        const dummyAuction: Auction = { entries: [], isComplete: false };
        const southHand = deal.hands[SeatEnum.South];
        const dummyContext = createBiddingContext({
          hand: southHand,
          auction: dummyAuction,
          seat: SeatEnum.South,
          evaluation: evaluateHand(southHand),
        });
        const computed = rule.call(dummyContext);
        if (computed.type === "bid") {
          referenceCall = computed;
        }
      } catch {
        // Call computation failed — leave badge empty
      }

      referenceRules.push({
        ruleName: rule.name,
        displayName: formatRuleName(rule.name),
        call: referenceCall,
        fired: false,
        firedBySeat: null,
        conditions,
        isConditioned: isConditionedRule(rule),
      });
    }
  }

  // Sort fired rules by auction appearance order
  firedRules.sort((a, b) => a.index - b.index);

  return {
    firedRules: firedRules.map((f) => f.rule),
    referenceRules,
  };
}

// ─── Round-by-round grouping ──────────────────────────────────

export interface RoundEntry {
  readonly seat: Seat;
  readonly call: Call;
  readonly ruleName: string | null;
  readonly meaning?: string;
  readonly handSummary?: string;
  readonly isUser: boolean;
  readonly isCorrect?: boolean;
  readonly expectedResult?: BidResult;
  readonly treePath?: TreeEvalSummary;
  readonly conditions?: readonly ConditionDetail[];
}

export interface RoundGroup {
  readonly roundNumber: number;
  readonly entries: readonly RoundEntry[];
}

/**
 * Group bid history entries into rounds of 4 (one full table rotation).
 * Every 4 consecutive bids form a round, regardless of dealer position.
 */
export function groupBidsByRound(
  bidHistory: readonly BidHistoryEntry[],
): RoundGroup[] {
  if (bidHistory.length === 0) return [];

  const groups: RoundGroup[] = [];
  for (let i = 0; i < bidHistory.length; i += 4) {
    const slice = bidHistory.slice(i, i + 4);
    groups.push({
      roundNumber: Math.floor(i / 4) + 1,
      entries: slice.map((e) => ({
        seat: e.seat,
        call: e.call,
        ruleName: e.ruleName,
        meaning: e.meaning,
        handSummary: e.handSummary,
        isUser: e.isUser,
        isCorrect: e.isCorrect,
        expectedResult: e.expectedResult,
        treePath: e.treePath,
        conditions: e.conditions,
      })),
    });
  }
  return groups;
}
