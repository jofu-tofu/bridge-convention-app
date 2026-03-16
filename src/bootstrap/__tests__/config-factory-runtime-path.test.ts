import { describe, it, expect, beforeEach } from "vitest";
import { buildBundleStrategy } from "../config-factory";
import { Seat, BidSuit } from "../../engine/types";
import type { Call, Hand } from "../../engine/types";
import { hand } from "../../engine/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import { buildAuction } from "../../engine/auction-helpers";
import { createBiddingContext } from "../../conventions/core";
import { clearRegistry, registerConvention } from "../../conventions/core/registry";
import { clearBundleRegistry, registerBundle } from "../../conventions/core/bundle";
import { ntBundle } from "../../conventions/definitions/nt-bundle";
import { ntBundleConventionConfig } from "../../conventions/definitions/nt-bundle/convention-config";

// ─── Helpers ────────────────────────────────────────────────

function formatCall(call: Call): string {
  if (call.type === "bid") {
    const strainNames = new Map<BidSuit, string>([
      [BidSuit.Clubs, "C"],
      [BidSuit.Diamonds, "D"],
      [BidSuit.Hearts, "H"],
      [BidSuit.Spades, "S"],
      [BidSuit.NoTrump, "NT"],
    ]);
    return `${call.level}${strainNames.get(call.strain) ?? "?"}`;
  }
  return call.type;
}

function suggestWithBundle(h: Hand, auctionCalls: string[]) {
  registerConvention(ntBundleConventionConfig);
  registerBundle(ntBundle);
  const strategy = buildBundleStrategy(ntBundle);
  expect(strategy).not.toBeNull();

  const auction = buildAuction(Seat.North, auctionCalls);
  const ctx = createBiddingContext({
    hand: h,
    auction,
    seat: Seat.South,
    evaluation: evaluateHand(h),
  });
  return strategy!.suggest(ctx);
}

// ═══════════════════════════════════════════════════════════════
// Characterization tests: buildBundleStrategy produces correct bids
// These must pass BEFORE and AFTER the evaluation runtime wiring change.
// ═══════════════════════════════════════════════════════════════

describe("buildBundleStrategy runtime path characterization", () => {
  beforeEach(() => {
    clearRegistry();
    clearBundleRegistry();
  });

  it("suggests 2C Stayman for 10 HCP hand with 4-4 majors", () => {
    // 10 HCP, 4S 4H → Stayman
    const h = hand(
      "SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2",
      "DA", "D5", "C8", "C3", "C2",
    );
    const result = suggestWithBundle(h, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2C");
  });

  it("suggests 2D transfer for weak hand with 5 hearts", () => {
    // Weak, 5H → transfer to hearts via 2D
    const h = hand(
      "S3", "S2", "HK", "HQ", "H8", "H7", "H5",
      "D6", "D4", "D2", "C7", "C5", "C3",
    );
    const result = suggestWithBundle(h, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2D");
  });

  it("suggests 3NT for game values with no 4-card major", () => {
    // 12 HCP, no 4-card major → 3NT
    const h = hand(
      "SA", "S8", "S3", "HK", "H7", "H4",
      "DA", "DQ", "D5", "CK", "C8", "C3", "C2",
    );
    const result = suggestWithBundle(h, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("3NT");
  });

  it("returns null for weak balanced hand with no major", () => {
    // 5 HCP, 3-3-4-3, no 4-card major → no convention bid
    const h = hand(
      "S8", "S5", "S3", "HJ", "H7", "H4",
      "DQ", "D5", "D2", "C8", "C6", "C3", "C2",
    );
    const result = suggestWithBundle(h, ["1NT", "P"]);
    expect(result).toBeNull();
  });

  it("suggests 2H transfer for hand with 5 spades", () => {
    // 8 HCP, 5S → transfer to spades via 2H
    const h = hand(
      "SA", "SQ", "SJ", "S8", "S3", "H7", "H4",
      "D6", "D4", "D2", "C7", "C5", "C3",
    );
    const result = suggestWithBundle(h, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2H");
  });
});
