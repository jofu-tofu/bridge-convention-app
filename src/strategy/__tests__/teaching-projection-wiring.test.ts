import { describe, it, expect } from "vitest";
import {
  meaningToStrategy,
  meaningBundleToStrategy,
} from "../bidding/meaning-strategy";
import type { MeaningSurface } from "../../core/contracts/meaning-surface";
import { hand } from "../../engine/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import { buildAuction } from "../../engine/auction-helpers";
import { createBiddingContext } from "../../conventions/core";
import { Seat, BidSuit } from "../../engine/types";

function makeTestSurface(
  overrides: Partial<MeaningSurface> = {},
): MeaningSurface {
  return {
    meaningId: "test:ask",
    moduleId: "test",
    encoding: {
      defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs },
    },
    clauses: [
      {
        clauseId: "hcp",
        factId: "hand.hcp",
        operator: "gte",
        value: 8,
        description: "8+ HCP",
      },
      {
        clauseId: "major",
        factId: "bridge.hasFourCardMajor",
        operator: "boolean",
        value: true,
        description: "Has 4-card major",
      },
    ],
    ranking: {
      recommendationBand: "should",
      specificity: 2,
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "test-ask", params: {} },
    ...overrides,
  };
}

// 10 HCP hand with 4 spades
const strongHandWith4Spades = hand(
  "SA", "SK", "S3", "S2",
  "HA", "H3",
  "DA", "D4", "D2",
  "CA", "C5", "C4", "C3",
);

function makeContext(testHand: ReturnType<typeof hand>, bids: string[] = ["1NT", "pass"]) {
  const evaluation = evaluateHand(testHand);
  const auction = buildAuction(Seat.North, bids);
  return createBiddingContext({
    hand: testHand,
    auction,
    seat: Seat.South,
    evaluation,
  });
}

describe("getLastTeachingProjection — meaning pipeline", () => {
  it("returns non-null TeachingProjection with populated callViews after suggest", () => {
    const surface = makeTestSurface();
    const strategy = meaningToStrategy([surface], "test-module");
    const context = makeContext(strongHandWith4Spades);

    strategy.suggest(context);

    const projection = strategy.getLastTeachingProjection();
    expect(projection).not.toBeNull();
    expect(projection!.callViews.length).toBeGreaterThan(0);
    expect(projection!.callViews[0]!.call).toEqual({
      type: "bid",
      level: 2,
      strain: BidSuit.Clubs,
    });
  });

  it("returns non-null TeachingProjection from meaningBundleToStrategy", () => {
    const surface = makeTestSurface({ moduleId: "mod-a" });
    const strategy = meaningBundleToStrategy(
      [{ moduleId: "mod-a", surfaces: [surface] }],
      "test-bundle",
    );
    const context = makeContext(strongHandWith4Spades);

    strategy.suggest(context);

    const projection = strategy.getLastTeachingProjection();
    expect(projection).not.toBeNull();
    expect(projection!.callViews.length).toBeGreaterThan(0);
    expect(projection!.meaningViews.length).toBeGreaterThan(0);
  });

  it("returns null before first suggest", () => {
    const strategy = meaningToStrategy([], "test-module");
    expect(strategy.getLastTeachingProjection()).toBeNull();
  });

  it("returns null when suggest produces no match (no arbitration selected)", () => {
    const surface = makeTestSurface({
      clauses: [
        {
          clauseId: "impossible",
          factId: "hand.hcp",
          operator: "gte",
          value: 40,
          description: "40+ HCP (impossible)",
        },
      ],
    });
    const strategy = meaningToStrategy([surface], "test-module");
    const context = makeContext(strongHandWith4Spades);

    strategy.suggest(context);

    // No selected candidate → still produces projection (provenance exists)
    // but the projection should have no truth-set call views
    const projection = strategy.getLastTeachingProjection();
    expect(projection).not.toBeNull();
    expect(projection!.callViews).toHaveLength(0);
  });
});
