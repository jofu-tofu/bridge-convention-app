import { describe, expect, test } from "vitest";
import { BidSuit, Seat } from "../../engine/types";
import { evaluateHand } from "../../engine/hand-evaluator";
import { decision } from "../../conventions/core/rule-tree";
import { intentBid } from "../../conventions/core/intent/intent-node";
import { SemanticIntentType } from "../../conventions/core/intent/semantic-intent";
import type { BiddingContext } from "../../conventions/core/types";
import type { TreeEvalResult } from "../../conventions/core/tree-evaluator";
import type { SiblingBid, ResolvedCandidateDTO } from "../../contracts";
import { hand } from "../../engine/__tests__/fixtures";
import {
  enrichSiblingsWithResolvedCalls,
  mapTreeEvalResult,
} from "../bidding/convention-strategy";

function makeSibling(
  bidName: string,
  call: { type: "bid"; level: 1 | 2 | 3 | 4 | 5 | 6 | 7; strain: BidSuit },
): SiblingBid {
  return {
    bidName,
    nodeId: `test/${bidName}`,
    meaning: `Meaning for ${bidName}`,
    call,
    failedConditions: [],
  };
}

function makeResolvedCandidate(
  bidName: string,
  call: { type: "bid"; level: 1 | 2 | 3 | 4 | 5 | 6 | 7; strain: BidSuit },
  resolvedCall: { type: "bid"; level: 1 | 2 | 3 | 4 | 5 | 6 | 7; strain: BidSuit },
  isDefaultCall: boolean,
): ResolvedCandidateDTO {
  return {
    bidName,
    meaning: `Meaning for ${bidName}`,
    call,
    resolvedCall,
    isDefaultCall,
    legal: true,
    isMatched: false,
    intentType: SemanticIntentType.Signoff,
    failedConditions: [],
  };
}

describe("enrichSiblingsWithResolvedCalls", () => {
  test("swaps resolved calls into siblings where resolver diverged (isDefaultCall: false)", () => {
    const siblings: readonly SiblingBid[] = [
      makeSibling("stayman-ask", { type: "bid", level: 2, strain: BidSuit.Clubs }),
    ];
    const resolvedCandidates: readonly ResolvedCandidateDTO[] = [
      makeResolvedCandidate(
        "stayman-ask",
        { type: "bid", level: 2, strain: BidSuit.Clubs },
        { type: "bid", level: 2, strain: BidSuit.Diamonds },
        false,
      ),
    ];

    const enriched = enrichSiblingsWithResolvedCalls(siblings, resolvedCandidates);
    expect(enriched[0]?.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Diamonds });
  });

  test("preserves original call for siblings where resolver did not diverge", () => {
    const siblings: readonly SiblingBid[] = [
      makeSibling("stayman-ask", { type: "bid", level: 2, strain: BidSuit.Clubs }),
    ];
    const resolvedCandidates: readonly ResolvedCandidateDTO[] = [
      makeResolvedCandidate(
        "stayman-ask",
        { type: "bid", level: 2, strain: BidSuit.Clubs },
        { type: "bid", level: 2, strain: BidSuit.Clubs },
        true,
      ),
    ];

    const enriched = enrichSiblingsWithResolvedCalls(siblings, resolvedCandidates);
    expect(enriched).toEqual(siblings);
  });

  test("returns unchanged array when resolvedCandidates is empty", () => {
    const siblings: readonly SiblingBid[] = [
      makeSibling("stayman-ask", { type: "bid", level: 2, strain: BidSuit.Clubs }),
    ];

    const enriched = enrichSiblingsWithResolvedCalls(siblings, []);
    expect(enriched).toBe(siblings);
  });

  test("preserves siblings with no matching candidate (guard clause for overlay-injected intents)", () => {
    const siblings: readonly SiblingBid[] = [
      makeSibling("stayman-ask", { type: "bid", level: 2, strain: BidSuit.Clubs }),
    ];
    const resolvedCandidates: readonly ResolvedCandidateDTO[] = [
      makeResolvedCandidate(
        "overlay-injected-intent",
        { type: "bid", level: 2, strain: BidSuit.Diamonds },
        { type: "bid", level: 2, strain: BidSuit.Hearts },
        false,
      ),
    ];

    const enriched = enrichSiblingsWithResolvedCalls(siblings, resolvedCandidates);
    expect(enriched).toEqual(siblings);
  });

  test("handles duplicate bidName in resolvedCandidates (last write wins, Map semantics)", () => {
    const siblings: readonly SiblingBid[] = [
      makeSibling("stayman-ask", { type: "bid", level: 2, strain: BidSuit.Clubs }),
    ];
    const resolvedCandidates: readonly ResolvedCandidateDTO[] = [
      makeResolvedCandidate(
        "stayman-ask",
        { type: "bid", level: 2, strain: BidSuit.Clubs },
        { type: "bid", level: 2, strain: BidSuit.Diamonds },
        false,
      ),
      makeResolvedCandidate(
        "stayman-ask",
        { type: "bid", level: 2, strain: BidSuit.Clubs },
        { type: "bid", level: 2, strain: BidSuit.Hearts },
        false,
      ),
    ];

    const enriched = enrichSiblingsWithResolvedCalls(siblings, resolvedCandidates);
    expect(enriched[0]?.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
  });

  test("mapTreeEvalResult returns enriched siblings when resolvedCandidates have diverged calls", () => {
    const alwaysTrue = {
      name: "always-true",
      label: "Always true",
      category: "hand" as const,
      test: () => true,
      describe: () => "Always true",
    };

    const matched = intentBid(
      "stayman-ask",
      "Ask for 4-card major",
      { type: SemanticIntentType.AskForMajor, params: {} },
      () => ({ type: "bid", level: 2, strain: BidSuit.Clubs }),
    );

    const sibling = intentBid(
      "stayman-response-diamond",
      "No major",
      { type: SemanticIntentType.DenyHeldSuit, params: {} },
      () => ({ type: "bid", level: 2, strain: BidSuit.Diamonds }),
    );

    const tree = decision("root", alwaysTrue, matched, sibling);

    const southHand = hand(
      "SA", "SK", "SQ", "SJ", "S9", "HA", "HK", "HQ", "H9", "DA", "DK", "CA", "CK",
    );
    const context: BiddingContext = {
      hand: southHand,
      auction: { entries: [], isComplete: false },
      seat: Seat.South,
      evaluation: evaluateHand(southHand),
      opponentConventionIds: [],
    };

    const treeEvalResult: TreeEvalResult = {
      matched,
      path: [{ node: tree, passed: true, description: "Always true" }],
      rejectedDecisions: [],
      visited: [{ node: tree, passed: true, description: "Always true" }],
    };

    const summary = mapTreeEvalResult(
      treeEvalResult,
      tree,
      context,
      undefined,
      undefined,
      [
        {
          bidName: "stayman-response-diamond",
          nodeId: "test/stayman-response-diamond",
          meaning: "No major",
          call: { type: "bid", level: 2, strain: BidSuit.Diamonds },
          intent: { type: SemanticIntentType.DenyHeldSuit, params: {} },
          source: {
            conventionId: "test",
            roundName: "test-round",
            nodeName: "stayman-response-diamond",
          },
          failedConditions: [],
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Hearts },
          isDefaultCall: false,
          legal: true,
          isMatched: false,
        },
      ],
    );

    expect(summary.siblings).toBeDefined();
    expect(summary.siblings?.[0]?.bidName).toBe("stayman-response-diamond");
    expect(summary.siblings?.[0]?.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
  });
});
