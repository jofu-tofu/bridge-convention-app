/**
 * Cross-pipeline parity test: Bergen meaning pipeline vs tree pipeline.
 *
 * Uses identical hands and auctions to verify both pipelines produce the
 * same call. This is the strongest validation that the meaning-centric
 * Bergen slice faithfully reproduces the tree-based convention's behavior.
 *
 * Hands are drawn directly from the tree-pipeline test suite
 * (src/conventions/__tests__/bergen-raises/rules-responder.test.ts).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../../engine/types";
import type { Call, Hand } from "../../../../engine/types";
import { hand } from "../../../../engine/__tests__/fixtures";
import { evaluateHand, calculateHcp } from "../../../../engine/hand-evaluator";
import { buildAuction } from "../../../../engine/auction-helpers";
import { createBiddingContext } from "../../../core";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../../../core/registry";
import { bergenConfig } from "../../bergen-raises";
import { createFactCatalog } from "../../../../core/contracts/fact-catalog";
import { createSharedFactCatalog } from "../../../core/pipeline/fact-evaluator";
import { meaningBundleToStrategy } from "../../../../strategy/bidding/meaning-strategy";
import { bergenBundle } from "../config";
import { bergenFacts } from "../facts";
import { refDescribe, policyDescribe } from "../../../../test-support/tiers";

// ─── Helpers ────────────────────────────────────────────────

function buildCatalog() {
  return createFactCatalog(createSharedFactCatalog(), bergenFacts);
}

function buildMachineStrategy() {
  const catalog = buildCatalog();
  const moduleSurfaces = bergenBundle.meaningSurfaces!.map((g) => ({
    moduleId: g.groupId,
    surfaces: g.surfaces,
  }));
  return meaningBundleToStrategy(moduleSurfaces, bergenBundle.id, {
    name: bergenBundle.name,
    factCatalog: catalog,
    conversationMachine: bergenBundle.conversationMachine,
  });
}

/** Get meaning pipeline result for a hand. */
function meaningResult(h: Hand, auctionCalls: string[]) {
  const strategy = buildMachineStrategy();
  const auction = buildAuction(Seat.North, auctionCalls);
  const ctx = createBiddingContext({
    hand: h,
    auction,
    seat: Seat.South,
    evaluation: evaluateHand(h),
  });
  return strategy.suggest(ctx);
}

/** Get tree pipeline result for a hand. */
function treeResult(h: Hand, auctionCalls: string[]) {
  const auction = buildAuction(Seat.North, auctionCalls);
  const ctx: Parameters<typeof evaluateBiddingRules>[0] = {
    hand: h,
    auction,
    seat: Seat.South,
    evaluation: evaluateHand(h),
    opponentConventionIds: [],
  };
  return evaluateBiddingRules(ctx, bergenConfig);
}

function callKey(call: Call): string {
  if (call.type === "bid") {
    const strainNames: Record<string, string> = {
      [BidSuit.Clubs]: "C",
      [BidSuit.Diamonds]: "D",
      [BidSuit.Hearts]: "H",
      [BidSuit.Spades]: "S",
      [BidSuit.NoTrump]: "NT",
    };
    return `${call.level}${strainNames[call.strain] ?? "?"}`;
  }
  return call.type;
}

// ─── Setup ──────────────────────────────────────────────────

beforeEach(() => {
  clearRegistry();
  registerConvention(bergenConfig);
});

// ─── Parity tests ────────────────────────────────────────────

refDescribe("[ref:bridgebum/bergen]", "Cross-pipeline parity: meaning vs tree — hearts R1", () => {
  it("constructive raise: 8 HCP, 4 hearts → both produce 3C", () => {
    const h = hand("S8","S5","S2","HK","HT","H6","H2","DK","DQ","D3","C5","C3","C2");
    expect(calculateHcp(h)).toBe(8);

    const tree = treeResult(h, ["1H", "P"]);
    const meaning = meaningResult(h, ["1H", "P"]);

    expect(tree).not.toBeNull();
    expect(meaning).not.toBeNull();
    expect(callKey(tree!.call)).toBe("3C");
    expect(callKey(meaning!.call)).toBe("3C");
    expect(callKey(meaning!.call)).toBe(callKey(tree!.call));
  });

  it("limit raise: 11 HCP, 4 hearts → both produce 3D", () => {
    const h = hand("SA","S5","S2","HK","HJ","H6","H2","DQ","D7","D3","CJ","C3","C2");
    expect(calculateHcp(h)).toBe(11);

    const tree = treeResult(h, ["1H", "P"]);
    const meaning = meaningResult(h, ["1H", "P"]);

    expect(tree).not.toBeNull();
    expect(meaning).not.toBeNull();
    expect(callKey(tree!.call)).toBe("3D");
    expect(callKey(meaning!.call)).toBe("3D");
    expect(callKey(meaning!.call)).toBe(callKey(tree!.call));
  });

  it("game raise: 14 HCP, 4 hearts → both produce 4H", () => {
    const h = hand("SA","SK","S2","HQ","HT","H6","H2","DK","DQ","D3","C5","C3","C2");
    expect(calculateHcp(h)).toBe(14);

    const tree = treeResult(h, ["1H", "P"]);
    const meaning = meaningResult(h, ["1H", "P"]);

    expect(tree).not.toBeNull();
    expect(meaning).not.toBeNull();
    expect(callKey(tree!.call)).toBe("4H");
    expect(callKey(meaning!.call)).toBe("4H");
    expect(callKey(meaning!.call)).toBe(callKey(tree!.call));
  });

  it("preemptive raise: 5 HCP, 4 hearts → both produce 3H", () => {
    const h = hand("S8","S5","S2","HK","HQ","H6","H2","DT","D7","D3","C5","C3","C2");
    expect(calculateHcp(h)).toBe(5);

    const tree = treeResult(h, ["1H", "P"]);
    const meaning = meaningResult(h, ["1H", "P"]);

    expect(tree).not.toBeNull();
    expect(meaning).not.toBeNull();
    expect(callKey(tree!.call)).toBe("3H");
    expect(callKey(meaning!.call)).toBe("3H");
    expect(callKey(meaning!.call)).toBe(callKey(tree!.call));
  });

  it("splinter: 13 HCP, 4 hearts, singleton spade → both produce 3S", () => {
    const h = hand("SA","HK","HQ","H7","H3","DA","D5","D3","D2","C5","C4","C3","C2");
    expect(calculateHcp(h)).toBe(13);

    const tree = treeResult(h, ["1H", "P"]);
    const meaning = meaningResult(h, ["1H", "P"]);

    expect(tree).not.toBeNull();
    expect(meaning).not.toBeNull();
    expect(callKey(tree!.call)).toBe("3S");
    expect(callKey(meaning!.call)).toBe("3S");
    expect(callKey(meaning!.call)).toBe(callKey(tree!.call));
  });

  it("no support: 3 hearts → both produce null", () => {
    const h = hand("S8","S5","S2","HK","HT","H6","DK","DQ","D7","D3","C5","C3","C2");
    expect(calculateHcp(h)).toBe(8);

    const tree = treeResult(h, ["1H", "P"]);
    const meaning = meaningResult(h, ["1H", "P"]);

    expect(tree).toBeNull();
    expect(meaning).toBeNull();
  });
});

refDescribe("[ref:bridgebum/bergen]", "Cross-pipeline parity: meaning vs tree — spades R1", () => {
  it("constructive raise: 8 HCP, 4 spades → both produce 3C", () => {
    const h = hand("SK","ST","S6","S2","H8","H5","H2","DK","DQ","D3","C5","C3","C2");
    expect(calculateHcp(h)).toBe(8);

    const tree = treeResult(h, ["1S", "P"]);
    const meaning = meaningResult(h, ["1S", "P"]);

    expect(tree).not.toBeNull();
    expect(meaning).not.toBeNull();
    expect(callKey(tree!.call)).toBe("3C");
    expect(callKey(meaning!.call)).toBe("3C");
  });

  it("game raise: 14 HCP, 4 spades → both produce 4S", () => {
    const h = hand("SK","SQ","S6","S2","HA","H5","H2","DK","DQ","D3","C5","C3","C2");
    expect(calculateHcp(h)).toBe(14);

    const tree = treeResult(h, ["1S", "P"]);
    const meaning = meaningResult(h, ["1S", "P"]);

    expect(tree).not.toBeNull();
    expect(meaning).not.toBeNull();
    expect(callKey(tree!.call)).toBe("4S");
    expect(callKey(meaning!.call)).toBe("4S");
  });

  it("preemptive raise: 4 HCP, 4 spades → both produce 3S", () => {
    const h = hand("SQ","SJ","S6","S2","H8","H5","H2","DJ","D7","D3","C5","C3","C2");
    expect(calculateHcp(h)).toBe(4);

    const tree = treeResult(h, ["1S", "P"]);
    const meaning = meaningResult(h, ["1S", "P"]);

    expect(tree).not.toBeNull();
    expect(meaning).not.toBeNull();
    expect(callKey(tree!.call)).toBe("3S");
    expect(callKey(meaning!.call)).toBe("3S");
  });

  it("splinter: 12 HCP, 4 spades, singleton heart → both produce 3H", () => {
    const h = hand("SK","SQ","S7","S3","HA","DK","D5","D3","D2","C5","C4","C3","C2");
    expect(calculateHcp(h)).toBe(12);

    const tree = treeResult(h, ["1S", "P"]);
    const meaning = meaningResult(h, ["1S", "P"]);

    expect(tree).not.toBeNull();
    expect(meaning).not.toBeNull();
    expect(callKey(tree!.call)).toBe("3H");
    expect(callKey(meaning!.call)).toBe("3H");
  });
});

policyDescribe(
  "[policy]",
  "HCP boundaries: both pipelines agree at 6/7, 10, 12 no-shortage, 13 no-shortage",
  "Cross-pipeline parity: HCP boundaries",
  () => {
    it("6 HCP → both preemptive (3H)", () => {
      const h = hand("S8","S5","S2","HK","HQ","H6","H2","DT","D7","D3","CJ","C5","C2");
      expect(calculateHcp(h)).toBe(6);

      const tree = treeResult(h, ["1H", "P"]);
      const meaning = meaningResult(h, ["1H", "P"]);

      expect(tree).not.toBeNull();
      expect(meaning).not.toBeNull();
      expect(callKey(tree!.call)).toBe("3H");
      expect(callKey(meaning!.call)).toBe("3H");
    });

    it("7 HCP → both constructive (3C)", () => {
      const h = hand("S8","S5","S2","HK","HQ","H6","H2","DJ","D7","D3","CJ","C5","C2");
      expect(calculateHcp(h)).toBe(7);

      const tree = treeResult(h, ["1H", "P"]);
      const meaning = meaningResult(h, ["1H", "P"]);

      expect(tree).not.toBeNull();
      expect(meaning).not.toBeNull();
      expect(callKey(tree!.call)).toBe("3C");
      expect(callKey(meaning!.call)).toBe("3C");
    });

    it("10 HCP → both limit (3D)", () => {
      const h = hand("S8","S5","S2","HK","HQ","H6","H2","DK","DQ","D3","C5","C3","C2");
      expect(calculateHcp(h)).toBe(10);

      const tree = treeResult(h, ["1H", "P"]);
      const meaning = meaningResult(h, ["1H", "P"]);

      expect(tree).not.toBeNull();
      expect(meaning).not.toBeNull();
      expect(callKey(tree!.call)).toBe("3D");
      expect(callKey(meaning!.call)).toBe("3D");
    });

    it("12 HCP no shortage → both limit (3D)", () => {
      const h = hand("SA","S5","S2","HK","HQ","H6","H2","DK","D7","D3","C5","C3","C2");
      expect(calculateHcp(h)).toBe(12);

      const tree = treeResult(h, ["1H", "P"]);
      const meaning = meaningResult(h, ["1H", "P"]);

      expect(tree).not.toBeNull();
      expect(meaning).not.toBeNull();
      expect(callKey(tree!.call)).toBe("3D");
      expect(callKey(meaning!.call)).toBe("3D");
    });

    it("13 HCP no shortage → both game (4H)", () => {
      const h = hand("SA","S5","S2","HK","HQ","H6","H2","DK","D7","D3","CJ","C3","C2");
      expect(calculateHcp(h)).toBe(13);

      const tree = treeResult(h, ["1H", "P"]);
      const meaning = meaningResult(h, ["1H", "P"]);

      expect(tree).not.toBeNull();
      expect(meaning).not.toBeNull();
      expect(callKey(tree!.call)).toBe("4H");
      expect(callKey(meaning!.call)).toBe("4H");
    });
  },
);

describe("Cross-pipeline parity: wrong auctions", () => {
  it("1NT-P → both produce null", () => {
    const h = hand("S8","S5","S2","HK","HT","H6","H2","DK","DQ","D3","C5","C3","C2");

    const tree = treeResult(h, ["1NT", "P"]);
    const meaning = meaningResult(h, ["1NT", "P"]);

    expect(tree).toBeNull();
    expect(meaning).toBeNull();
  });

  it("1D-P → both produce null", () => {
    const h = hand("S8","S5","S2","HK","HT","H6","H2","DK","DQ","D3","C5","C3","C2");

    const tree = treeResult(h, ["1D", "P"]);
    const meaning = meaningResult(h, ["1D", "P"]);

    expect(tree).toBeNull();
    expect(meaning).toBeNull();
  });
});
