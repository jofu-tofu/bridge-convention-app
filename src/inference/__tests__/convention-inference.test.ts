import { describe, it, expect, beforeEach } from "vitest";
import { createConventionInferenceProvider } from "../convention-inference";
import { Seat, BidSuit, Suit } from "../../engine/types";
import type { Auction, AuctionEntry } from "../../engine/types";
import {
  registerConvention,
  clearRegistry,
} from "../../conventions/core/registry";
import { staymanConfig } from "../../conventions/definitions/stayman";

function makeEntry(seat: Seat, call: AuctionEntry["call"]): AuctionEntry {
  return { seat, call };
}

describe("createConventionInferenceProvider", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
  });

  it("extracts HCP and suit inferences from Stayman ask rule", () => {
    const provider = createConventionInferenceProvider("stayman");
    const entry = makeEntry(Seat.South, {
      type: "bid",
      level: 2,
      strain: BidSuit.Clubs,
    });
    const auctionBefore: Auction = {
      entries: [
        makeEntry(Seat.North, {
          type: "bid",
          level: 1,
          strain: BidSuit.NoTrump,
        }),
        makeEntry(Seat.East, { type: "pass" }),
      ],
      isComplete: false,
    };

    const result = provider.inferFromBid(entry, auctionBefore, Seat.South);

    // stayman-ask rule matches 2C bid and has hcpMin(8)
    expect(result).not.toBeNull();
    expect(result!.minHcp).toBe(8);
    expect(result!.source).toBe("stayman-ask");
  });

  it("matches 2H response to correct stayman-response rule", () => {
    const provider = createConventionInferenceProvider("stayman");
    const entry = makeEntry(Seat.North, {
      type: "bid",
      level: 2,
      strain: BidSuit.Hearts,
    });
    const auctionBefore: Auction = {
      entries: [
        makeEntry(Seat.North, {
          type: "bid",
          level: 1,
          strain: BidSuit.NoTrump,
        }),
        makeEntry(Seat.East, { type: "pass" }),
        makeEntry(Seat.South, {
          type: "bid",
          level: 2,
          strain: BidSuit.Clubs,
        }),
        makeEntry(Seat.West, { type: "pass" }),
      ],
      isComplete: false,
    };

    const result = provider.inferFromBid(entry, auctionBefore, Seat.North);

    // 2H matches the stayman-response-hearts rule
    expect(result).not.toBeNull();
    expect(result!.source).toBe("stayman-response-hearts");
    expect(result!.suits[Suit.Hearts]?.minLength).toBe(4);
  });

  it("matches 2S response to correct stayman-response rule", () => {
    const provider = createConventionInferenceProvider("stayman");
    const entry = makeEntry(Seat.North, {
      type: "bid",
      level: 2,
      strain: BidSuit.Spades,
    });
    // V2: auction conditions must match — 2S response requires 1NT-P-2C-P auction
    const auctionBefore: Auction = {
      entries: [
        makeEntry(Seat.North, { type: "bid", level: 1, strain: BidSuit.NoTrump }),
        makeEntry(Seat.East, { type: "pass" }),
        makeEntry(Seat.South, { type: "bid", level: 2, strain: BidSuit.Clubs }),
        makeEntry(Seat.West, { type: "pass" }),
      ],
      isComplete: false,
    };

    const result = provider.inferFromBid(entry, auctionBefore, Seat.North);

    // 2S matches stayman-response-spades rule
    expect(result).not.toBeNull();
    expect(result!.source).toBe("stayman-response-spades");
  });

  it("returns null for unregistered convention", () => {
    const provider = createConventionInferenceProvider("nonexistent");
    const entry = makeEntry(Seat.South, { type: "pass" });
    const result = provider.inferFromBid(
      entry,
      { entries: [], isComplete: false },
      Seat.South,
    );

    expect(result).toBeNull();
  });

  it("returns null for pass (no convention rule produces pass)", () => {
    const provider = createConventionInferenceProvider("stayman");
    const entry = makeEntry(Seat.South, { type: "pass" });
    const result = provider.inferFromBid(
      entry,
      { entries: [], isComplete: false },
      Seat.South,
    );

    // No Stayman rule produces a pass, so no match
    expect(result).toBeNull();
  });

  it("Stayman 2D denial returns null (negated conditions lack inference metadata)", () => {
    const provider = createConventionInferenceProvider("stayman");
    const entry = makeEntry(Seat.North, {
      type: "bid",
      level: 2,
      strain: BidSuit.Diamonds,
    });
    // After 1NT-P-2C-P, opener responds 2D (denial = no 4-card major)
    const auctionBefore: Auction = {
      entries: [
        makeEntry(Seat.North, { type: "bid", level: 1, strain: BidSuit.NoTrump }),
        makeEntry(Seat.East, { type: "pass" }),
        makeEntry(Seat.South, { type: "bid", level: 2, strain: BidSuit.Clubs }),
        makeEntry(Seat.West, { type: "pass" }),
      ],
      isComplete: false,
    };

    const result = provider.inferFromBid(entry, auctionBefore, Seat.North);

    // The denial rule's handConditions are negated (not-has-4-hearts, not-has-4-spades)
    // and intentionally lack .inference metadata. Extracting negative hand inferences
    // from denial rules requires enhancing flattenTree to carry inverted .inference
    // on negated conditions — tracked as future enhancement.
    expect(result).toBeNull();
  });

  it("caches flattened rules across multiple inferFromBid calls", () => {
    const provider = createConventionInferenceProvider("stayman");
    const auctionBefore: Auction = {
      entries: [
        makeEntry(Seat.North, {
          type: "bid",
          level: 1,
          strain: BidSuit.NoTrump,
        }),
        makeEntry(Seat.East, { type: "pass" }),
      ],
      isComplete: false,
    };

    // Call inferFromBid multiple times (simulating 8-12 bids per auction)
    const entry2C = makeEntry(Seat.South, {
      type: "bid",
      level: 2,
      strain: BidSuit.Clubs,
    });
    const result1 = provider.inferFromBid(entry2C, auctionBefore, Seat.South);
    const result2 = provider.inferFromBid(entry2C, auctionBefore, Seat.South);

    // Both calls should produce identical results
    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result1!.minHcp).toBe(result2!.minHcp);
    expect(result1!.source).toBe(result2!.source);

    // Verify the cached rules getter returns the same array reference
    // (exposed for this test — ensures flattenTree is not called per-bid)
    expect(provider.cachedRules).toBeDefined();
    const ref1 = provider.cachedRules;
    // Call again to confirm reference stability
    provider.inferFromBid(entry2C, auctionBefore, Seat.South);
    expect(provider.cachedRules).toBe(ref1);
  });

  it("does not return inferences from a non-matching rule", () => {
    const provider = createConventionInferenceProvider("stayman");
    // Bid 1NT — stayman-ask is 2C, so should NOT match stayman-ask
    const entry = makeEntry(Seat.South, {
      type: "bid",
      level: 1,
      strain: BidSuit.NoTrump,
    });
    const result = provider.inferFromBid(
      entry,
      { entries: [], isComplete: false },
      Seat.South,
    );

    // 1NT matches the 1NT opening rule if present, not stayman-ask
    if (result) {
      expect(result.source).not.toBe("stayman-ask");
    }
  });
});
