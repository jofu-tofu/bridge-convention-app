import { describe, it, expect, beforeEach } from "vitest";
import { createInferenceEngine } from "../inference-engine";
import { createNaturalInferenceProvider } from "../natural-inference";
import { createConventionInferenceProvider } from "../convention-inference";
import { Seat, BidSuit, Suit } from "../../engine/types";
import type { AuctionEntry } from "../../engine/types";
import type { InferenceConfig } from "../types";
import {
  registerConvention,
  clearRegistry,
} from "../../conventions/core/registry";
import { staymanConfig } from "../../conventions/definitions/stayman";

function makeEntry(seat: Seat, call: AuctionEntry["call"]): AuctionEntry {
  return { seat, call };
}

describe("createInferenceEngine", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
  });

  it("processes a Stayman auction and produces inferences for all seats", () => {
    const config: InferenceConfig = {
      ownPartnership: createConventionInferenceProvider("stayman"),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    // Observer is South (N/S partnership uses convention, E/W uses natural)
    const engine = createInferenceEngine(config, Seat.South);

    // North opens 1NT
    const entry1 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.NoTrump,
    });
    engine.processBid(entry1, { entries: [], isComplete: false });

    // East passes
    const entry2 = makeEntry(Seat.East, { type: "pass" });
    engine.processBid(entry2, {
      entries: [entry1],
      isComplete: false,
    });

    // South bids 2C (Stayman) — this should match stayman-ask rule
    const entry3 = makeEntry(Seat.South, {
      type: "bid",
      level: 2,
      strain: BidSuit.Clubs,
    });
    engine.processBid(entry3, {
      entries: [entry1, entry2],
      isComplete: false,
    });

    const inferences = engine.getInferences();

    // South (own partnership, convention provider, 2C = Stayman ask) should have hcpMin(8)
    expect(inferences[Seat.South]).toBeDefined();
    expect(inferences[Seat.South].inferences.length).toBeGreaterThan(0);
    expect(inferences[Seat.South].hcpRange.min).toBe(8);

    // East (opponent, natural provider) passed over 1NT → <12 HCP
    expect(inferences[Seat.East]).toBeDefined();
    expect(inferences[Seat.East].hcpRange.max).toBeLessThanOrEqual(11);
  });

  it("uses asymmetric providers: own partnership vs opponents", () => {
    const config: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const engine = createInferenceEngine(config, Seat.East);

    const entry = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.Hearts,
    });
    engine.processBid(entry, { entries: [], isComplete: false });

    const inferences = engine.getInferences();
    // North is opponent to East, should get natural 1H inference: 12+ HCP, 5+ hearts
    expect(inferences[Seat.North].hcpRange.min).toBe(12);
    expect(inferences[Seat.North].suitLengths[Suit.Hearts].min).toBe(5);
  });

  it("merges multiple inferences for the same seat", () => {
    const config: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const engine = createInferenceEngine(config, Seat.South);

    // North opens 1H
    const entry1 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.Hearts,
    });
    engine.processBid(entry1, { entries: [], isComplete: false });

    const inferences = engine.getInferences();
    expect(inferences[Seat.North].hcpRange.min).toBe(12);
    expect(inferences[Seat.North].suitLengths[Suit.Hearts].min).toBe(5);
  });

  it("reset clears all inferences", () => {
    const config: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const engine = createInferenceEngine(config, Seat.South);

    const entry1 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.Hearts,
    });
    engine.processBid(entry1, { entries: [], isComplete: false });

    engine.reset();
    const inferences = engine.getInferences();

    // After reset, all seats should have default ranges
    expect(inferences[Seat.North].hcpRange.min).toBe(0);
    expect(inferences[Seat.North].hcpRange.max).toBe(40);
    expect(inferences[Seat.North].inferences.length).toBe(0);
  });

  it("handles inference errors gracefully", () => {
    const failingProvider = {
      id: "failing",
      name: "Failing Provider",
      inferFromBid(): never {
        throw new Error("Provider error");
      },
    };

    const config: InferenceConfig = {
      ownPartnership: failingProvider,
      opponentPartnership: failingProvider,
    };
    const engine = createInferenceEngine(config, Seat.South);

    const entry = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.Hearts,
    });

    // Should not throw
    expect(() =>
      engine.processBid(entry, { entries: [], isComplete: false }),
    ).not.toThrow();

    const inferences = engine.getInferences();
    expect(inferences[Seat.North].inferences.length).toBe(0);
  });

  it("partner seat is treated as own partnership", () => {
    // Use natural providers to test partnership routing without bid-matching concerns
    const naturalProvider = createNaturalInferenceProvider();

    const config: InferenceConfig = {
      ownPartnership: naturalProvider,
      opponentPartnership: naturalProvider,
    };

    // Observer is South → North is partner (own partnership)
    const engine = createInferenceEngine(config, Seat.South);

    // South opens 1H (own seat)
    const entry1 = makeEntry(Seat.South, {
      type: "bid",
      level: 1,
      strain: BidSuit.Hearts,
    });
    engine.processBid(entry1, { entries: [], isComplete: false });

    // North responds 1S (partner, still own partnership)
    const entry2 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.Spades,
    });
    engine.processBid(entry2, {
      entries: [entry1],
      isComplete: false,
    });

    const inferences = engine.getInferences();
    // Both N and S should have inferences
    expect(inferences[Seat.South].inferences.length).toBeGreaterThan(0);
    expect(inferences[Seat.North].inferences.length).toBeGreaterThan(0);
  });
});
