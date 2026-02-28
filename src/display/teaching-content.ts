import type {
  RuleCondition,
  BiddingContext,
  ConventionConfig,
  ConventionTeaching,
} from "../conventions/core/types";
import type {
  ConventionExplanations,
  BidMetadata,
  RuleNode,
  ConventionTreeRoot,
  AuctionSlotNode,
} from "../conventions/core/rule-tree";
import type { Call } from "../engine/types";
import {
  getConditionExplanation,
  getConditionExplanationWithParams,
  getFailureExplanation,
} from "./condition-explanations";

// ─── Types ──────────────────────────────────────────────────

export interface TeachingCondition {
  readonly name: string;
  readonly label: string;
  readonly category: "auction" | "hand";
  readonly explanation: string | null;
  readonly explainedWithParams: string | null;
  readonly condition: RuleCondition;
  /** True when this condition appears via the NO branch (negated). */
  readonly isNegated?: boolean;
}

export interface TeachingBidOption {
  readonly bidName: string;
  readonly meaning: string;
  readonly handConditions: readonly TeachingCondition[];
  readonly allConditions: readonly TeachingCondition[];
  readonly bidMetadata: BidMetadata | null;
  readonly callResolver: (ctx: BiddingContext) => Call;
}

export interface TeachingRound {
  readonly auctionContext: readonly TeachingCondition[];
  readonly auctionLabel: string;
  readonly bidOptions: readonly TeachingBidOption[];
}

export interface TeachingContent {
  readonly conventionId: string;
  readonly conventionName: string;
  readonly description: string;
  readonly category: string;
  readonly teaching: ConventionTeaching | null;
  readonly rounds: readonly TeachingRound[];
  readonly totalBidOptions: number;
  readonly usedConditionTypes: readonly string[];
}

// ─── Evaluated types ────────────────────────────────────────

export interface EvaluatedTeachingCondition extends TeachingCondition {
  readonly passed: boolean;
  readonly contextDescription: string;
  readonly failureDetail: string | null;
}

export interface EvaluatedBidOption extends TeachingBidOption {
  readonly evaluatedConditions: readonly EvaluatedTeachingCondition[];
  readonly handWouldMatch: boolean;
  readonly resolvedCall: Call | null;
}

export interface EvaluatedTeachingRound extends TeachingRound {
  readonly evaluatedBidOptions: readonly EvaluatedBidOption[];
  readonly matchedBid: EvaluatedBidOption | null;
}

// ─── extractTeachingContent ─────────────────────────────────

function makeTeachingCondition(
  condition: RuleCondition,
  explanations?: ConventionExplanations,
): TeachingCondition {
  return {
    name: condition.name,
    label: condition.label,
    category: condition.category,
    explanation: getConditionExplanation(condition, explanations),
    explainedWithParams: getConditionExplanationWithParams(
      condition,
      explanations,
    ),
    condition,
  };
}

interface CollectedBid {
  readonly auctionConditions: readonly TeachingCondition[];
  readonly auctionDecisionNames: readonly string[];
  readonly handConditions: readonly TeachingCondition[];
  readonly bidName: string;
  readonly meaning: string;
  readonly bidMetadata: BidMetadata | null;
  readonly callResolver: (ctx: BiddingContext) => Call;
}

function walkTree(
  node: RuleNode,
  auctionAcc: readonly TeachingCondition[],
  auctionNames: readonly string[],
  handAcc: readonly TeachingCondition[],
  explanations: ConventionExplanations | undefined,
  collected: CollectedBid[],
): void {
  switch (node.type) {
    case "decision": {
      const tc = makeTeachingCondition(node.condition, explanations);
      if (node.condition.category === "auction") {
        // YES: append to auction accumulator with DecisionNode name
        walkTree(node.yes, [...auctionAcc, tc], [...auctionNames, node.name], handAcc, explanations, collected);
        // NO: structural negation — same accumulator
        walkTree(node.no, auctionAcc, auctionNames, handAcc, explanations, collected);
      } else {
        // Hand condition: YES accumulates the condition, NO accumulates a negated version
        walkTree(node.yes, auctionAcc, auctionNames, [...handAcc, tc], explanations, collected);
        walkTree(node.no, auctionAcc, auctionNames, [...handAcc, { ...tc, isNegated: true }], explanations, collected);
      }
      break;
    }
    case "bid": {
      const bidMeta =
        explanations?.bids?.[node.name] ?? node.metadata ?? null;
      collected.push({
        auctionConditions: auctionAcc,
        auctionDecisionNames: auctionNames,
        handConditions: handAcc,
        bidName: node.name,
        meaning: node.meaning,
        bidMetadata: bidMeta,
        callResolver: node.call,
      });
      break;
    }
    case "fallback":
      // Skip
      break;
  }
}

function roundKey(bid: CollectedBid): string {
  return bid.auctionDecisionNames.join("|");
}

function walkSlotTree(
  node: AuctionSlotNode,
  auctionAcc: readonly TeachingCondition[],
  auctionNames: readonly string[],
  explanations: ConventionExplanations | undefined,
  collected: CollectedBid[],
): void {
  for (const s of node.slots) {
    const tc = makeTeachingCondition(s.condition, explanations);
    const slotAuctionAcc = [...auctionAcc, tc];
    const slotAuctionNames = [...auctionNames, s.name];

    if (s.child.type === "auction-slots") {
      walkSlotTree(s.child, slotAuctionAcc, slotAuctionNames, explanations, collected);
    } else {
      // Hand subtree
      walkTree(s.child as RuleNode, slotAuctionAcc, slotAuctionNames, [], explanations, collected);
    }
  }
  // Default child
  if (node.defaultChild) {
    walkTree(node.defaultChild as RuleNode, auctionAcc, auctionNames, [], explanations, collected);
  }
}

export function extractTeachingContent(
  config: ConventionConfig,
  explanations?: ConventionExplanations,
): TeachingContent | null {
  if (!config.ruleTree && !config.protocol) return null;

  const collected: CollectedBid[] = [];
  if (config.protocol) {
    // Protocol conventions: recursively walk rounds, accumulating trigger
    // conditions + seatFilters across rounds so teaching shows the full
    // conversation context (e.g., "1NT was bid → Stayman 2C → Opener shows hearts").
    type ProtoRound = (typeof config.protocol.rounds)[number];
    function walkProtocolRounds(
      roundIdx: number,
      accConds: readonly TeachingCondition[],
      accNames: readonly string[],
      accEst: Record<string, unknown>,
    ): void {
      const rounds = config.protocol!.rounds;
      if (roundIdx >= rounds.length) return;
      const r = rounds[roundIdx] as ProtoRound;
      for (const trigger of r.triggers) {
        const pathConds = [...accConds, makeTeachingCondition(trigger.condition, explanations)];
        const pathNames = [...accNames, trigger.condition.name];
        // Add seatFilter as an auction condition if present
        if (r.seatFilter) {
          pathConds.push(makeTeachingCondition(r.seatFilter, explanations));
          pathNames.push(r.seatFilter.name);
        }
        const est = { ...accEst, ...trigger.establishes };

        // Flatten this round's hand tree with accumulated conditions
        let handTree: import("../conventions/core/rule-tree").RuleNode | null;
        if (typeof r.handTree === "function") {
          try {
            handTree = r.handTree(est as never) as import("../conventions/core/rule-tree").RuleNode;
          } catch {
            handTree = null;
          }
        } else {
          handTree = r.handTree as import("../conventions/core/rule-tree").RuleNode;
        }
        if (handTree) {
          walkTree(handTree, pathConds, pathNames, [], explanations, collected);
        }

        // Recurse to next round with accumulated conditions + context
        walkProtocolRounds(roundIdx + 1, pathConds, pathNames, est);
      }
    }
    walkProtocolRounds(0, [], [], { role: "responder" as const });
  } else {
    const tree: ConventionTreeRoot = config.ruleTree!;
    if (tree.type === "auction-slots") {
      walkSlotTree(tree, [], [], explanations, collected);
    } else {
      walkTree(tree, [], [], [], explanations, collected);
    }
  }

  // Group by auction context (round key)
  const roundMap = new Map<
    string,
    { auctionConditions: readonly TeachingCondition[]; bids: CollectedBid[] }
  >();

  for (const bid of collected) {
    const key = roundKey(bid);
    if (!roundMap.has(key)) {
      roundMap.set(key, {
        auctionConditions: bid.auctionConditions,
        bids: [],
      });
    }
    roundMap.get(key)!.bids.push(bid);
  }

  const rounds: TeachingRound[] = [];
  for (const [, group] of roundMap) {
    const auctionLabel =
      group.auctionConditions.length === 0
        ? "Opening position"
        : group.auctionConditions.map((c) => c.label).join(" → ");

    const bidOptions: TeachingBidOption[] = group.bids.map((b) => ({
      bidName: b.bidName,
      meaning: b.meaning,
      handConditions: b.handConditions,
      allConditions: [...b.auctionConditions, ...b.handConditions],
      bidMetadata: b.bidMetadata,
      callResolver: b.callResolver,
    }));

    rounds.push({
      auctionContext: group.auctionConditions,
      auctionLabel,
      bidOptions,
    });
  }

  // Collect usedConditionTypes
  const conditionTypes = new Set<string>();
  for (const bid of collected) {
    for (const c of [...bid.auctionConditions, ...bid.handConditions]) {
      if (c.condition.inference?.type) {
        conditionTypes.add(c.condition.inference.type);
      }
    }
  }

  const totalBidOptions = rounds.reduce(
    (sum, r) => sum + r.bidOptions.length,
    0,
  );

  return {
    conventionId: config.id,
    conventionName: config.name,
    description: config.description,
    category: config.category,
    teaching: explanations?.convention ?? config.teaching ?? null,
    rounds,
    totalBidOptions,
    usedConditionTypes: [...conditionTypes],
  };
}

// ─── evaluateTeachingRound ──────────────────────────────────

export function evaluateTeachingRound(
  round: TeachingRound,
  context: BiddingContext,
): EvaluatedTeachingRound {
  let matchedBid: EvaluatedBidOption | null = null;

  const evaluatedBidOptions: EvaluatedBidOption[] = round.bidOptions.map(
    (bidOption) => {
      const evaluatedConditions: EvaluatedTeachingCondition[] =
        bidOption.handConditions.map((tc) => {
          const rawPassed = tc.condition.test(context);
          const passed = tc.isNegated ? !rawPassed : rawPassed;
          return {
            ...tc,
            passed,
            contextDescription: tc.condition.describe(context),
            failureDetail: passed
              ? null
              : getFailureExplanation(tc.condition, context),
          };
        });

      const handWouldMatch = evaluatedConditions.every((c) => c.passed);

      let resolvedCall: Call | null = null;
      if (handWouldMatch) {
        try {
          resolvedCall = bidOption.callResolver(context);
        } catch {
          resolvedCall = null;
        }
      }

      const evaluated: EvaluatedBidOption = {
        ...bidOption,
        evaluatedConditions,
        handWouldMatch,
        resolvedCall,
      };

      if (handWouldMatch && matchedBid === null) {
        matchedBid = evaluated;
      }

      return evaluated;
    },
  );

  return {
    ...round,
    evaluatedBidOptions,
    matchedBid,
  };
}
