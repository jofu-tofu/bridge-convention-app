/**
 * Tests for partner interpretation model.
 * Assert ordering/comparisons, not exact floats (monotonic contracts).
 */
import { describe, test, expect } from "vitest";
import { Seat, Suit } from "../../engine/types";
import type { AuctionEntry, Auction, ContractBid } from "../../engine/types";
import type { InferenceProvider } from "../types";
import { computePartnerInterpretation } from "../partner-interpretation";

const suitBid = (level: number, strain: string): ContractBid =>
  ({ type: "bid", level, strain } as ContractBid);

function makeAuction(entries: AuctionEntry[]): Auction {
  return { entries, isComplete: false };
}

function makeProvider(inferFn: InferenceProvider["inferFromBid"]): InferenceProvider {
  return {
    id: "test-provider",
    name: "Test Provider",
    inferFromBid: inferFn,
  };
}

describe("computePartnerInterpretation", () => {
  test("Stayman 2C with matching hand -> low misunderstandingRisk", () => {
    // Stayman 2C: partner expects 8-11 HCP and a 4-card major
    const provider = makeProvider(() => ({
      seat: Seat.South,
      minHcp: 8,
      maxHcp: 11,
      suits: {
        [Suit.Hearts]: { minLength: 4, maxLength: undefined },
        [Suit.Spades]: { minLength: 4, maxLength: undefined },
      },
      source: "stayman-ask",
    }));

    const result = computePartnerInterpretation(
      suitBid(2, "C"),
      makeAuction([
        { seat: Seat.North, call: suitBid(1, "NT") },
      ]),
      Seat.South,
      { hcp: 10, shape: [4, 4, 3, 2] }, // 4S, 4H, 3D, 2C — matches
      provider,
    );

    // HCP 10 is midpoint of 8-11, so risk should be low
    expect(result.misunderstandingRisk).toBeLessThan(0.3);
  });

  test("Stayman 2C with mismatched hand -> higher risk", () => {
    // Partner expects 8-11 HCP
    const provider = makeProvider(() => ({
      seat: Seat.South,
      minHcp: 8,
      maxHcp: 11,
      suits: {},
      source: "stayman-ask",
    }));

    const matchingResult = computePartnerInterpretation(
      suitBid(2, "C"),
      makeAuction([{ seat: Seat.North, call: suitBid(1, "NT") }]),
      Seat.South,
      { hcp: 10, shape: [4, 4, 3, 2] }, // 10 HCP in range
      provider,
    );

    const mismatchedResult = computePartnerInterpretation(
      suitBid(2, "C"),
      makeAuction([{ seat: Seat.North, call: suitBid(1, "NT") }]),
      Seat.South,
      { hcp: 3, shape: [4, 4, 3, 2] }, // 3 HCP well below range
      provider,
    );

    expect(mismatchedResult.misunderstandingRisk).toBeGreaterThan(matchingResult.misunderstandingRisk);
  });

  test("natural bid with long suit -> low continuationAwkwardness", () => {
    // Partner expects 5+ hearts
    const provider = makeProvider(() => ({
      seat: Seat.South,
      minHcp: 6,
      maxHcp: 17,
      suits: {
        [Suit.Hearts]: { minLength: 5, maxLength: undefined },
      },
      source: "natural-bid",
    }));

    const result = computePartnerInterpretation(
      suitBid(1, "H"),
      makeAuction([]),
      Seat.South,
      { hcp: 12, shape: [2, 6, 3, 2] }, // 6 hearts — exceeds minimum
      provider,
    );

    expect(result.continuationAwkwardness).toBe(0);
  });

  test("natural bid with short suit -> higher continuationAwkwardness", () => {
    // Partner expects 5+ hearts
    const provider = makeProvider(() => ({
      seat: Seat.South,
      minHcp: 6,
      maxHcp: 17,
      suits: {
        [Suit.Hearts]: { minLength: 5, maxLength: undefined },
      },
      source: "natural-bid",
    }));

    const longResult = computePartnerInterpretation(
      suitBid(1, "H"),
      makeAuction([]),
      Seat.South,
      { hcp: 12, shape: [2, 6, 3, 2] }, // 6 hearts
      provider,
    );

    const shortResult = computePartnerInterpretation(
      suitBid(1, "H"),
      makeAuction([]),
      Seat.South,
      { hcp: 12, shape: [4, 2, 4, 3] }, // only 2 hearts
      provider,
    );

    expect(shortResult.continuationAwkwardness).toBeGreaterThan(longResult.continuationAwkwardness);
  });

  test("inferFromBid returns null -> risk=0 (fail-open)", () => {
    const provider = makeProvider(() => null);

    const result = computePartnerInterpretation(
      suitBid(2, "C"),
      makeAuction([{ seat: Seat.North, call: suitBid(1, "NT") }]),
      Seat.South,
      { hcp: 10, shape: [4, 4, 3, 2] },
      provider,
    );

    expect(result.misunderstandingRisk).toBe(0);
    expect(result.continuationAwkwardness).toBe(0);
  });

  test("exact HCP match with zero-width range -> risk=0", () => {
    // Range min=max=10, actual=10 -> risk should be 0
    const provider = makeProvider(() => ({
      seat: Seat.South,
      minHcp: 10,
      maxHcp: 10,
      suits: {},
      source: "precise-bid",
    }));

    const result = computePartnerInterpretation(
      suitBid(3, "NT"),
      makeAuction([]),
      Seat.South,
      { hcp: 10, shape: [3, 3, 4, 3] },
      provider,
    );

    expect(result.misunderstandingRisk).toBe(0);
  });

  test("HCP mismatch with zero-width range -> risk=1", () => {
    // Range min=max=10, actual=15 -> risk should be 1
    const provider = makeProvider(() => ({
      seat: Seat.South,
      minHcp: 10,
      maxHcp: 10,
      suits: {},
      source: "precise-bid",
    }));

    const result = computePartnerInterpretation(
      suitBid(3, "NT"),
      makeAuction([]),
      Seat.South,
      { hcp: 15, shape: [3, 3, 4, 3] },
      provider,
    );

    expect(result.misunderstandingRisk).toBe(1);
  });

  test("publicMeaning comes from inference source", () => {
    const provider = makeProvider(() => ({
      seat: Seat.South,
      minHcp: 8,
      maxHcp: 11,
      suits: {},
      source: "stayman-ask",
    }));

    const result = computePartnerInterpretation(
      suitBid(2, "C"),
      makeAuction([]),
      Seat.South,
      { hcp: 10, shape: [4, 4, 3, 2] },
      provider,
    );

    expect(result.publicMeaning).toBe("stayman-ask");
  });

  test("partnerExpectedHcp defaults to 0-40 when inference has no HCP", () => {
    const provider = makeProvider(() => ({
      seat: Seat.South,
      suits: { [Suit.Hearts]: { minLength: 5 } },
      source: "heart-bid",
    }));

    const result = computePartnerInterpretation(
      suitBid(1, "H"),
      makeAuction([]),
      Seat.South,
      { hcp: 12, shape: [3, 5, 3, 2] },
      provider,
    );

    expect(result.partnerExpectedHcp.min).toBe(0);
    expect(result.partnerExpectedHcp.max).toBe(40);
  });

  test("multiple suit expectations averaged for awkwardness", () => {
    // Partner expects 4+ spades and 4+ hearts, we have 2S and 2H
    const provider = makeProvider(() => ({
      seat: Seat.South,
      minHcp: 10,
      maxHcp: 15,
      suits: {
        [Suit.Spades]: { minLength: 4 },
        [Suit.Hearts]: { minLength: 4 },
      },
      source: "two-suited",
    }));

    const result = computePartnerInterpretation(
      suitBid(2, "S"),
      makeAuction([]),
      Seat.South,
      { hcp: 12, shape: [2, 2, 5, 4] }, // 2S, 2H, 5D, 4C
      provider,
    );

    // Shortfall in spades: max(0, 4-2)/13 = 2/13
    // Shortfall in hearts: max(0, 4-2)/13 = 2/13
    // Average over 2 suits: 2/13
    expect(result.continuationAwkwardness).toBeGreaterThan(0.1);
    expect(result.continuationAwkwardness).toBeLessThan(0.3);
  });
});
