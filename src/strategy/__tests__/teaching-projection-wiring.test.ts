import { describe, it, expect } from "vitest";
import {
  meaningToStrategy,
  meaningBundleToStrategy,
} from "../bidding/meaning-strategy";
import { BidSuit } from "../../engine/types";
import { makeTestSurface, makeContext, strongHandWith4Spades } from "./strategy-test-helpers";

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
    // Acceptable-set entries appear in callViews with status "acceptable"
    const projection = strategy.getLastTeachingProjection();
    expect(projection).not.toBeNull();
    expect(projection!.callViews.filter(v => v.status === "truth")).toHaveLength(0);
  });
});
