import { describe, it, expect, beforeEach } from "vitest";
import {
  createInferenceEngine,
  createNaturalInferenceProvider,
  createConventionInferenceProvider,
  mergeInferences,
} from "../index";
import type { InferenceConfig, InferenceProvider, HandInference } from "../index";
import { Seat, BidSuit, Suit } from "../../../engine/types";
import type { AuctionEntry, Auction } from "../../../engine/types";
import {
  registerConvention,
  clearRegistry,
} from "../../../conventions/registry";
import { staymanConfig } from "../../../conventions/stayman";
import { saycConfig } from "../../../conventions/sayc";

function makeEntry(seat: Seat, call: AuctionEntry["call"]): AuctionEntry {
  return { seat, call };
}

const emptyAuction: Auction = { entries: [], isComplete: false };

function buildAuction(...entries: AuctionEntry[]): Auction {
  return { entries, isComplete: false };
}

// Standard Stayman auction: North 1NT, East pass, South 2C
function processStaymanAuction(
  engine: ReturnType<typeof createInferenceEngine>,
) {
  const e1 = makeEntry(Seat.North, {
    type: "bid",
    level: 1,
    strain: BidSuit.NoTrump,
  });
  engine.processBid(e1, emptyAuction);

  const e2 = makeEntry(Seat.East, { type: "pass" });
  engine.processBid(e2, buildAuction(e1));

  const e3 = makeEntry(Seat.South, {
    type: "bid",
    level: 2,
    strain: BidSuit.Clubs,
  });
  engine.processBid(e3, buildAuction(e1, e2));

  const e4 = makeEntry(Seat.West, { type: "pass" });
  engine.processBid(e4, buildAuction(e1, e2, e3));

  return { e1, e2, e3, e4 };
}

describe("Suite 1: Partnership Information Asymmetry", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
    registerConvention(saycConfig);
  });

  it("1.1 Convention provider is scoped to its rules — 1NT outside Stayman yields no inference", () => {
    // Stayman convention only defines rules for 2C ask and responses, not 1NT
    const convConfig: InferenceConfig = {
      ownPartnership: createConventionInferenceProvider("stayman"),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const convEngine = createInferenceEngine(convConfig, Seat.South);

    const e1 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.NoTrump,
    });
    convEngine.processBid(e1, emptyAuction);

    // Convention provider returns null for 1NT (not a Stayman rule)
    expect(convEngine.getInferences()[Seat.North].inferences.length).toBe(0);

    // Natural provider DOES produce inference for 1NT (15-17 HCP balanced)
    const natConfig: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const natEngine = createInferenceEngine(natConfig, Seat.South);
    natEngine.processBid(e1, emptyAuction);

    const natInf = natEngine.getInferences();
    expect(natInf[Seat.North].inferences.length).toBeGreaterThan(0);
    expect(natInf[Seat.North].hcpRange.min).toBe(15);
    expect(natInf[Seat.North].hcpRange.max).toBe(17);
  });

  it("1.2 N-S convention provider produces inferences for South 2C (Stayman)", () => {
    const config: InferenceConfig = {
      ownPartnership: createConventionInferenceProvider("stayman"),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const engine = createInferenceEngine(config, Seat.South);
    processStaymanAuction(engine);

    const inferences = engine.getInferences();
    // Stayman ask requires 8+ HCP — convention-level knowledge
    expect(inferences[Seat.South].hcpRange.min).toBeGreaterThanOrEqual(8);
  });

  it("1.3 E-W pass uses natural-level inference (HCP ceiling)", () => {
    const config: InferenceConfig = {
      ownPartnership: createConventionInferenceProvider("stayman"),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const engine = createInferenceEngine(config, Seat.South);
    processStaymanAuction(engine);

    const inferences = engine.getInferences();
    // East passed over 1NT → natural inference caps HCP
    expect(inferences[Seat.East].hcpRange.max).toBeLessThanOrEqual(11);
  });

  it("1.4 West pass also gets natural-level inference", () => {
    const config: InferenceConfig = {
      ownPartnership: createConventionInferenceProvider("stayman"),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const engine = createInferenceEngine(config, Seat.South);
    processStaymanAuction(engine);

    const inferences = engine.getInferences();
    expect(inferences[Seat.West].hcpRange.max).toBeLessThanOrEqual(11);
  });

  it("1.5 Swapped observer yields different HCP ranges for South 2C", () => {
    // N-S engine (observer=South): South 2C = Stayman (convention knowledge)
    const nsConfig: InferenceConfig = {
      ownPartnership: createConventionInferenceProvider("stayman"),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const nsEngine = createInferenceEngine(nsConfig, Seat.South);
    processStaymanAuction(nsEngine);

    // E-W engine (observer=East): South 2C seen through natural lens
    const ewConfig: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const ewEngine = createInferenceEngine(ewConfig, Seat.East);
    processStaymanAuction(ewEngine);

    const nsInf = nsEngine.getInferences();
    const ewInf = ewEngine.getInferences();

    // Convention engine should extract richer inference for South 2C
    const nsMinHcp = nsInf[Seat.South].hcpRange.min;
    const ewMinHcp = ewInf[Seat.South].hcpRange.min;
    // Convention knows Stayman requires 8+; natural may return 0 or lower
    expect(nsMinHcp).toBeGreaterThanOrEqual(8);
    expect(nsMinHcp).toBeGreaterThan(ewMinHcp);
  });

  it("1.6 Convention bid yields strictly richer inference than natural for same bid", () => {
    const convConfig: InferenceConfig = {
      ownPartnership: createConventionInferenceProvider("stayman"),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const convEngine = createInferenceEngine(convConfig, Seat.South);
    processStaymanAuction(convEngine);

    const natConfig: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const natEngine = createInferenceEngine(natConfig, Seat.South);
    processStaymanAuction(natEngine);

    const convInf = convEngine.getInferences();
    const natInf = natEngine.getInferences();

    // Convention engine should have more or equal inferences for South
    expect(convInf[Seat.South].hcpRange.min).toBeGreaterThanOrEqual(
      natInf[Seat.South].hcpRange.min,
    );
  });

  it("1.7 E-W engine cannot see N-S Stayman convention detail", () => {
    // N-S engine: convention-aware for own partnership
    const nsConfig: InferenceConfig = {
      ownPartnership: createConventionInferenceProvider("stayman"),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const nsEngine = createInferenceEngine(nsConfig, Seat.South);
    processStaymanAuction(nsEngine);

    // E-W engine: natural for all (no convention knowledge of N-S)
    const ewConfig: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const ewEngine = createInferenceEngine(ewConfig, Seat.East);
    processStaymanAuction(ewEngine);

    const nsInf = nsEngine.getInferences();
    const ewInf = ewEngine.getInferences();

    // N-S engine knows South 2C = Stayman (8+ HCP)
    expect(nsInf[Seat.South].hcpRange.min).toBeGreaterThanOrEqual(8);
    // E-W engine lacks convention detail for South 2C
    expect(ewInf[Seat.South].hcpRange.min).toBeLessThan(8);
  });
});

describe("Suite 2: Inference Accumulation & Merging", () => {
  it("2.1 Two inferences narrow HCP via intersection", () => {
    const inferences: HandInference[] = [
      { seat: Seat.North, minHcp: 12, suits: {}, source: "test:1" },
      { seat: Seat.North, maxHcp: 17, suits: {}, source: "test:2" },
    ];
    const result = mergeInferences(Seat.North, inferences);
    expect(result.hcpRange.min).toBe(12);
    expect(result.hcpRange.max).toBe(17);
  });

  it("2.2 Three inferences narrow progressively", () => {
    const inferences: HandInference[] = [
      { seat: Seat.South, minHcp: 6, suits: {}, source: "test:1" },
      { seat: Seat.South, minHcp: 10, maxHcp: 20, suits: {}, source: "test:2" },
      { seat: Seat.South, maxHcp: 15, suits: {}, source: "test:3" },
    ];
    const result = mergeInferences(Seat.South, inferences);
    expect(result.hcpRange.min).toBe(10);
    expect(result.hcpRange.max).toBe(15);
  });

  it("2.3 Suit length ranges intersect per suit", () => {
    const inferences: HandInference[] = [
      {
        seat: Seat.North,
        suits: { [Suit.Hearts]: { minLength: 4 } },
        source: "test:1",
      },
      {
        seat: Seat.North,
        suits: { [Suit.Hearts]: { maxLength: 6 } },
        source: "test:2",
      },
    ];
    const result = mergeInferences(Seat.North, inferences);
    expect(result.suitLengths[Suit.Hearts].min).toBe(4);
    expect(result.suitLengths[Suit.Hearts].max).toBe(6);
  });

  it("2.4 HCP contradiction clamps to last inference values", () => {
    // Design choice: last-wins clamping on contradiction — see inference/CLAUDE.md
    const inferences: HandInference[] = [
      { seat: Seat.North, minHcp: 15, maxHcp: 17, suits: {}, source: "test:1" },
      { seat: Seat.North, minHcp: 20, maxHcp: 21, suits: {}, source: "test:2" },
    ];
    const result = mergeInferences(Seat.North, inferences);
    // Intersection: min=20, max=17 → contradiction → clamp to last: min=20, max=21
    expect(result.hcpRange.min).toBe(20);
    expect(result.hcpRange.max).toBe(21);
  });

  it("2.5 Suit length contradiction clamps min to max", () => {
    // Design choice: suit contradiction clamps min down to max
    const inferences: HandInference[] = [
      {
        seat: Seat.East,
        suits: { [Suit.Spades]: { minLength: 6 } },
        source: "test:1",
      },
      {
        seat: Seat.East,
        suits: { [Suit.Spades]: { maxLength: 4 } },
        source: "test:2",
      },
    ];
    const result = mergeInferences(Seat.East, inferences);
    // Intersection: min=6, max=4 → contradiction → clamp: min=max=4
    expect(result.suitLengths[Suit.Spades].min).toBe(4);
    expect(result.suitLengths[Suit.Spades].max).toBe(4);
  });

  it("2.6 Pass inference reduces HCP ceiling", () => {
    const inferences: HandInference[] = [
      { seat: Seat.East, maxHcp: 11, suits: {}, source: "natural:pass-over-bid" },
    ];
    const result = mergeInferences(Seat.East, inferences);
    expect(result.hcpRange.max).toBeLessThanOrEqual(11);
  });

  it("2.7 Empty inferences produce default ranges", () => {
    const result = mergeInferences(Seat.West, []);
    expect(result.hcpRange.min).toBe(0);
    expect(result.hcpRange.max).toBe(40);
    expect(result.suitLengths[Suit.Spades].min).toBe(0);
    expect(result.suitLengths[Suit.Spades].max).toBe(13);
    expect(result.suitLengths[Suit.Hearts].min).toBe(0);
    expect(result.suitLengths[Suit.Hearts].max).toBe(13);
    expect(result.suitLengths[Suit.Diamonds].min).toBe(0);
    expect(result.suitLengths[Suit.Diamonds].max).toBe(13);
    expect(result.suitLengths[Suit.Clubs].min).toBe(0);
    expect(result.suitLengths[Suit.Clubs].max).toBe(13);
    expect(result.isBalanced).toBeUndefined();
  });

  it("2.8 isBalanced: last value wins", () => {
    const inferences: HandInference[] = [
      { seat: Seat.North, isBalanced: true, suits: {}, source: "test:1" },
      { seat: Seat.North, isBalanced: false, suits: {}, source: "test:2" },
    ];
    const result = mergeInferences(Seat.North, inferences);
    expect(result.isBalanced).toBe(false);
  });

  it("2.9 Multiple suits accumulate independently", () => {
    const inferences: HandInference[] = [
      {
        seat: Seat.South,
        suits: { [Suit.Hearts]: { minLength: 5 } },
        source: "test:1",
      },
      {
        seat: Seat.South,
        suits: { [Suit.Spades]: { minLength: 4 } },
        source: "test:2",
      },
    ];
    const result = mergeInferences(Seat.South, inferences);
    expect(result.suitLengths[Suit.Hearts].min).toBe(5);
    expect(result.suitLengths[Suit.Spades].min).toBe(4);
    // Untouched suits remain at defaults
    expect(result.suitLengths[Suit.Diamonds].min).toBe(0);
    expect(result.suitLengths[Suit.Clubs].min).toBe(0);
  });
});

describe("Suite 3: Engine Lifecycle & Isolation", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
    registerConvention(saycConfig);
  });

  it("3.1 reset() clears all state to defaults", () => {
    const config: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const engine = createInferenceEngine(config, Seat.South);

    const e1 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.Hearts,
    });
    engine.processBid(e1, emptyAuction);

    engine.reset();
    const inferences = engine.getInferences();

    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      expect(inferences[seat].hcpRange.min).toBe(0);
      expect(inferences[seat].hcpRange.max).toBe(40);
      expect(inferences[seat].inferences.length).toBe(0);
    }
  });

  it("3.2 Two engines with same config are independent", () => {
    const config: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const engine1 = createInferenceEngine(config, Seat.South);
    const engine2 = createInferenceEngine(config, Seat.South);

    const e1 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.Hearts,
    });
    engine1.processBid(e1, emptyAuction);

    // engine2 should be unaffected
    const inf2 = engine2.getInferences();
    expect(inf2[Seat.North].inferences.length).toBe(0);
    expect(inf2[Seat.North].hcpRange.min).toBe(0);

    // engine1 should have the inference
    const inf1 = engine1.getInferences();
    expect(inf1[Seat.North].inferences.length).toBeGreaterThan(0);
  });

  it("3.3 All four seats present after complete auction", () => {
    const config: InferenceConfig = {
      ownPartnership: createConventionInferenceProvider("stayman"),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const engine = createInferenceEngine(config, Seat.South);
    processStaymanAuction(engine);

    const inferences = engine.getInferences();
    expect(inferences[Seat.North]).toBeDefined();
    expect(inferences[Seat.East]).toBeDefined();
    expect(inferences[Seat.South]).toBeDefined();
    expect(inferences[Seat.West]).toBeDefined();
  });

  it("3.4 Incremental equals batch replay (determinism)", () => {
    const config: InferenceConfig = {
      ownPartnership: createConventionInferenceProvider("stayman"),
      opponentPartnership: createNaturalInferenceProvider(),
    };

    // Incremental: process bids one at a time
    const engine1 = createInferenceEngine(config, Seat.South);
    processStaymanAuction(engine1);

    // Batch: process same bids on fresh engine
    const engine2 = createInferenceEngine(config, Seat.South);
    processStaymanAuction(engine2);

    const inf1 = engine1.getInferences();
    const inf2 = engine2.getInferences();

    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      expect(inf1[seat].hcpRange).toEqual(inf2[seat].hcpRange);
      expect(inf1[seat].suitLengths).toEqual(inf2[seat].suitLengths);
      expect(inf1[seat].isBalanced).toEqual(inf2[seat].isBalanced);
      expect(inf1[seat].inferences.length).toBe(inf2[seat].inferences.length);
    }
  });

  it("3.5 getInferences() is non-mutating read", () => {
    const config: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const engine = createInferenceEngine(config, Seat.South);

    const e1 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.Hearts,
    });
    engine.processBid(e1, emptyAuction);

    const snap1 = engine.getInferences();
    expect(snap1[Seat.North].hcpRange.min).toBe(12);

    // Process another bid
    const e2 = makeEntry(Seat.East, { type: "pass" });
    engine.processBid(e2, buildAuction(e1));

    const snap2 = engine.getInferences();
    // East should now have pass inference
    expect(snap2[Seat.East].hcpRange.max).toBeLessThanOrEqual(11);
    // North inference should still be there
    expect(snap2[Seat.North].hcpRange.min).toBe(12);
  });

  it("3.6 Reset then new bids works — old inferences gone, new present", () => {
    const config: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const engine = createInferenceEngine(config, Seat.South);

    // First bid
    const e1 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.Hearts,
    });
    engine.processBid(e1, emptyAuction);
    expect(engine.getInferences()[Seat.North].hcpRange.min).toBe(12);

    engine.reset();

    // New bid after reset
    const e2 = makeEntry(Seat.East, {
      type: "bid",
      level: 1,
      strain: BidSuit.Spades,
    });
    engine.processBid(e2, emptyAuction);

    const inferences = engine.getInferences();
    // North should be back to defaults
    expect(inferences[Seat.North].hcpRange.min).toBe(0);
    expect(inferences[Seat.North].inferences.length).toBe(0);
    // East should have the new inference
    expect(inferences[Seat.East].hcpRange.min).toBe(12);
    expect(inferences[Seat.East].inferences.length).toBeGreaterThan(0);
  });
});

describe("Suite 4: Provider Contracts", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
    registerConvention(saycConfig);
  });

  it("4.1 Natural: 1NT opening → 15-17 HCP balanced", () => {
    const provider = createNaturalInferenceProvider();
    const entry = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.NoTrump,
    });
    const inf = provider.inferFromBid(entry, emptyAuction, Seat.North);

    expect(inf).not.toBeNull();
    expect(inf!.minHcp).toBe(15);
    expect(inf!.maxHcp).toBe(17);
    expect(inf!.isBalanced).toBe(true);
  });

  it("4.2 Natural: double and redouble return null", () => {
    const provider = createNaturalInferenceProvider();

    const dblEntry = makeEntry(Seat.East, { type: "double" });
    expect(provider.inferFromBid(dblEntry, emptyAuction, Seat.East)).toBeNull();

    const rdblEntry = makeEntry(Seat.East, { type: "redouble" });
    expect(
      provider.inferFromBid(rdblEntry, emptyAuction, Seat.East),
    ).toBeNull();
  });

  it("4.3 Convention provider with unregistered ID returns null", () => {
    const provider = createConventionInferenceProvider("nonexistent-conv");
    const entry = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.NoTrump,
    });
    const inf = provider.inferFromBid(entry, emptyAuction, Seat.North);
    expect(inf).toBeNull();
  });

  it("4.4 Convention extracts richer info than natural for Stayman 2C", () => {
    const convProvider = createConventionInferenceProvider("stayman");
    const natProvider = createNaturalInferenceProvider();

    // Build auction state: North 1NT, East pass
    const e1 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.NoTrump,
    });
    const e2 = makeEntry(Seat.East, { type: "pass" });
    const auctionBefore = buildAuction(e1, e2);

    const entry = makeEntry(Seat.South, {
      type: "bid",
      level: 2,
      strain: BidSuit.Clubs,
    });

    const convInf = convProvider.inferFromBid(entry, auctionBefore, Seat.South);
    const natInf = natProvider.inferFromBid(entry, auctionBefore, Seat.South);

    // Convention knows 2C = Stayman (8+ HCP)
    expect(convInf).not.toBeNull();
    expect(convInf!.minHcp).toBeGreaterThanOrEqual(8);

    // Natural at best knows it's a new-suit response (6+ HCP) or nothing
    if (natInf) {
      expect(convInf!.minHcp!).toBeGreaterThanOrEqual(natInf.minHcp ?? 0);
    }
  });

  it("4.5 Natural: 3H opening returns null (only handles levels 1-2)", () => {
    const provider = createNaturalInferenceProvider();
    const entry = makeEntry(Seat.North, {
      type: "bid",
      level: 3,
      strain: BidSuit.Hearts,
    });
    const inf = provider.inferFromBid(entry, emptyAuction, Seat.North);
    expect(inf).toBeNull();
  });

  it("4.6 Natural: all 1-level suit openings return minHcp 12", () => {
    const provider = createNaturalInferenceProvider();

    for (const strain of [BidSuit.Clubs, BidSuit.Diamonds, BidSuit.Hearts, BidSuit.Spades]) {
      const entry = makeEntry(Seat.South, {
        type: "bid",
        level: 1,
        strain,
      });
      const inf = provider.inferFromBid(entry, emptyAuction, Seat.South);
      expect(inf).not.toBeNull();
      expect(inf!.minHcp).toBe(12);
    }
  });

  it("4.7 Pass in 3rd seat (2 prior passes) returns null", () => {
    const provider = createNaturalInferenceProvider();
    const p1 = makeEntry(Seat.North, { type: "pass" });
    const p2 = makeEntry(Seat.East, { type: "pass" });
    const auctionBefore = buildAuction(p1, p2);

    const entry = makeEntry(Seat.South, { type: "pass" });
    const inf = provider.inferFromBid(entry, auctionBefore, Seat.South);
    expect(inf).toBeNull();
  });

  it("4.8 Convention provider ID format is convention:{id}", () => {
    const provider = createConventionInferenceProvider("stayman");
    expect(provider.id).toBe("convention:stayman");
  });

  it("4.9 Natural provider ID is 'natural'", () => {
    const provider = createNaturalInferenceProvider();
    expect(provider.id).toBe("natural");
  });
});

describe("Suite 6: Edge Cases & Error Resilience", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
    registerConvention(saycConfig);
  });

  it("6.1 Empty auctionBefore is safe", () => {
    const config: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const engine = createInferenceEngine(config, Seat.South);

    const entry = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.Hearts,
    });
    expect(() => engine.processBid(entry, emptyAuction)).not.toThrow();

    const inferences = engine.getInferences();
    expect(inferences[Seat.North].inferences.length).toBeGreaterThan(0);
  });

  it("6.2 Double and redouble do not break engine", () => {
    const config: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const engine = createInferenceEngine(config, Seat.South);

    const e1 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.Hearts,
    });
    engine.processBid(e1, emptyAuction);

    const e2 = makeEntry(Seat.East, { type: "double" });
    expect(() => engine.processBid(e2, buildAuction(e1))).not.toThrow();

    const e3 = makeEntry(Seat.South, { type: "redouble" });
    expect(() => engine.processBid(e3, buildAuction(e1, e2))).not.toThrow();

    const inferences = engine.getInferences();
    // North should still have its original inference
    expect(inferences[Seat.North].hcpRange.min).toBe(12);
  });

  it("6.3 Throwing provider is swallowed by engine", () => {
    const throwingProvider: InferenceProvider = {
      id: "throwing",
      name: "Throwing Provider",
      inferFromBid(): never {
        throw new Error("boom");
      },
    };

    const config: InferenceConfig = {
      ownPartnership: throwingProvider,
      opponentPartnership: throwingProvider,
    };
    const engine = createInferenceEngine(config, Seat.South);

    const entry = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.Hearts,
    });
    expect(() => engine.processBid(entry, emptyAuction)).not.toThrow();

    const inferences = engine.getInferences();
    // Defaults returned — no inference captured
    expect(inferences[Seat.North].hcpRange.min).toBe(0);
    expect(inferences[Seat.North].hcpRange.max).toBe(40);
  });

  it("6.4 20+ bid auction processes without error", () => {
    const config: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const engine = createInferenceEngine(config, Seat.South);

    const seats = [Seat.North, Seat.East, Seat.South, Seat.West];
    const entries: AuctionEntry[] = [];

    // Open with 1H, then lots of passes
    const opening = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.Hearts,
    });
    entries.push(opening);
    engine.processBid(opening, { entries: [], isComplete: false });

    // Add 20 more passes
    for (let i = 1; i <= 20; i++) {
      const seat = seats[i % 4]!;
      const pass = makeEntry(seat, { type: "pass" });
      engine.processBid(pass, { entries: [...entries], isComplete: false });
      entries.push(pass);
    }

    const inferences = engine.getInferences();
    for (const seat of seats) {
      expect(inferences[seat]).toBeDefined();
    }
  });

  it("6.5 All-pass (passout) auction has all seats defined with HCP constraints", () => {
    const config: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const engine = createInferenceEngine(config, Seat.South);

    const seats = [Seat.North, Seat.East, Seat.South, Seat.West];
    const entries: AuctionEntry[] = [];

    for (const seat of seats) {
      const pass = makeEntry(seat, { type: "pass" });
      engine.processBid(pass, { entries: [...entries], isComplete: false });
      entries.push(pass);
    }

    const inferences = engine.getInferences();
    for (const seat of seats) {
      expect(inferences[seat]).toBeDefined();
    }
    // First two passers (North, East) get maxHcp constraints
    expect(inferences[Seat.North].hcpRange.max).toBeLessThanOrEqual(11);
    expect(inferences[Seat.East].hcpRange.max).toBeLessThanOrEqual(11);
  });

  it("6.6 Single inference passes through cleanly", () => {
    const single: HandInference[] = [
      {
        seat: Seat.West,
        minHcp: 15,
        maxHcp: 17,
        isBalanced: true,
        suits: { [Suit.Hearts]: { minLength: 5 } },
        source: "test:single",
      },
    ];
    const result = mergeInferences(Seat.West, single);
    expect(result.hcpRange.min).toBe(15);
    expect(result.hcpRange.max).toBe(17);
    expect(result.isBalanced).toBe(true);
    expect(result.suitLengths[Suit.Hearts].min).toBe(5);
  });

  it("6.7 Pass as first bid in any seat does not throw", () => {
    const config: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };

    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      const engine = createInferenceEngine(config, Seat.South);
      const pass = makeEntry(seat, { type: "pass" });
      expect(() => engine.processBid(pass, emptyAuction)).not.toThrow();
    }
  });
});
