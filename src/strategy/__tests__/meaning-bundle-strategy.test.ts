import { describe, it, expect } from "vitest";
import { meaningBundleToStrategy } from "../bidding/meaning-strategy";
import { hand } from "../../engine/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import { buildAuction } from "../../engine/auction-helpers";
import { createBiddingContext } from "../../conventions/core";
import { Seat, BidSuit } from "../../engine/types";
import {
  RESPONDER_SURFACES,
  OPENER_TRANSFER_HEARTS_SURFACES,
} from "../../conventions/definitions/nt-bundle/meaning-surfaces";

// ─── Convention-only responder surfaces (exclude natural NT) ──

const RESPONDER_CONVENTION_SURFACES = RESPONDER_SURFACES.filter(
  (s) => s.moduleId === "stayman" || s.moduleId === "jacoby-transfers",
);

// ─── Strategy under test ─────────────────────────────────────

const responderStrategy = meaningBundleToStrategy(
  [
    { moduleId: "stayman", surfaces: RESPONDER_CONVENTION_SURFACES.filter((s) => s.moduleId === "stayman") },
    { moduleId: "jacoby-transfers", surfaces: RESPONDER_CONVENTION_SURFACES.filter((s) => s.moduleId === "jacoby-transfers") },
  ],
  "nt-responder-bundle",
  { name: "1NT Responder Bundle" },
);

describe("meaningBundleToStrategy with real 1NT surfaces", () => {
  it("returns correct BidResult for gold scenario 1 (10 HCP 4S 4H → 2C)", () => {
    // S:KQ83 H:J742 D:A5 C:832
    const h = hand(
      "SK", "SQ", "S8", "S3",
      "HJ", "H7", "H4", "H2",
      "DA", "D5",
      "C8", "C3", "C2",
    );
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const ctx = createBiddingContext({
      hand: h, auction, seat: Seat.South, evaluation: evaluateHand(h),
    });

    const result = responderStrategy.suggest(ctx);

    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });
    expect(result!.ruleName).toBe("stayman:ask-major");
  });

  it("returns null for scenario 4 (neither convention eligible)", () => {
    // S:K83 H:J74 D:A52 C:8632 — 8 HCP, no 4M, no 5M
    const h = hand(
      "SK", "S8", "S3",
      "HJ", "H7", "H4",
      "DA", "D5", "D2",
      "C8", "C6", "C3", "C2",
    );
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const ctx = createBiddingContext({
      hand: h, auction, seat: Seat.South, evaluation: evaluateHand(h),
    });

    const result = responderStrategy.suggest(ctx);

    expect(result).toBeNull();
  });

  it("BidResult has correct shape with call, ruleName, explanation, handSummary, conditions", () => {
    // 9 HCP 5H hand
    const h = hand(
      "SA", "S3",
      "HK", "HQ", "H8", "H7", "H5",
      "D6", "D4", "D2",
      "C7", "C5", "C3",
    );
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const ctx = createBiddingContext({
      hand: h, auction, seat: Seat.South, evaluation: evaluateHand(h),
    });

    const result = responderStrategy.suggest(ctx);

    expect(result).not.toBeNull();
    expect(result!.call).toBeDefined();
    expect(result!.call.type).toBe("bid");
    expect(result!.ruleName).toBe("transfer:to-hearts");
    expect(result!.explanation).toBeTruthy();
    expect(result!.handSummary).toBeTruthy();
    expect(result!.evaluationTrace).toBeDefined();
    expect(result!.evaluationTrace!.conventionId).toBe("jacoby-transfers");
  });

  it("strategy can be used in a chain — returns null gracefully when no match", () => {
    // Opener strategy — only has transfer accept surfaces
    const openerTransferStrategy = meaningBundleToStrategy(
      [{ moduleId: "jacoby-transfers", surfaces: OPENER_TRANSFER_HEARTS_SURFACES }],
      "nt-opener-transfer-bundle",
    );

    // Use a responder context — opener surfaces should not match since
    // the transfer accept has no hand clauses (always matches if legal)
    // but this tests the pattern of chaining
    const h = hand(
      "SK", "S8", "S3",
      "HJ", "H7", "H4",
      "DA", "D5", "D2",
      "C8", "C6", "C3", "C2",
    );
    const auction = buildAuction(Seat.North, ["1NT", "P", "2D", "P"]);
    const ctx = createBiddingContext({
      hand: h, auction, seat: Seat.North, evaluation: evaluateHand(h),
    });

    const result = openerTransferStrategy.suggest(ctx);

    // Transfer accept has no clauses — always matches when legal
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });

    // Now test with an opener stayman strategy on the same context — should return null
    // since 2D-P auction doesn't match stayman response position
    // (but the meaning pipeline doesn't check auction position — it just checks hand facts)
    // For a true "no match" test, use the responder strategy on a hand that doesn't match
    const noMatchResult = responderStrategy.suggest(
      createBiddingContext({
        hand: h,
        auction: buildAuction(Seat.North, ["1NT", "P"]),
        seat: Seat.South,
        evaluation: evaluateHand(h),
      }),
    );

    // 8 HCP, no 4M, no 5M — nothing matches in convention surfaces
    expect(noMatchResult).toBeNull();
  });
});
