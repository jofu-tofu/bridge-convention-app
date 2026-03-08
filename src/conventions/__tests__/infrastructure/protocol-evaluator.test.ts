import { describe, it, expect } from "vitest";
import { BidSuit, Seat } from "../../../engine/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { hand } from "../../../engine/__tests__/fixtures";
import { createBiddingContext } from "../../core/context-factory";
import type { BiddingContext, AuctionCondition } from "../../core/types";
import { handDecision } from "../../core/rule-tree";
import { hcpMin } from "../../core/conditions";
import {
  partnerOpenedAt,
  auctionMatches,
  bidMade,
  bidMadeAtLevel,
  doubleMade,
  opponentOpenedAt,
  seatHasActed,
  seatDoubled,
  seatBidAt,
  partnerLastBidAtLevel,
  partnerDoubled,
} from "../../core/conditions/auction-conditions";
import { isResponder, isOpener } from "../../core/conditions";
import { protocol, round, semantic, validateProtocol } from "../../core/protocol";
import type { EstablishedContext } from "../../core/protocol";
import { evaluateProtocol, computeRole } from "../../core/protocol-evaluator";
import { alwaysTrue, staticBid } from "../tree-test-helpers";

// ─── Test helpers ────────────────────────────────────────────

/** 13 HCP hand: SA SK SQ SJ HA H5 H3 D5 D3 D2 C5 C3 C2 */
const testHand = () =>
  hand("SA", "SK", "SQ", "SJ", "HA", "H5", "H3", "D5", "D3", "D2", "C5", "C3", "C2");


function makeContext(bids: string[], seat: Seat, dealer: Seat): BiddingContext {
  const h = testHand();
  return createBiddingContext({
    hand: h,
    auction: buildAuction(dealer, bids),
    seat,
    evaluation: evaluateHand(h),
  });
}

// ─── computeRole ─────────────────────────────────────────────

describe("computeRole", () => {
  it("returns opener when seat made the first bid", () => {
    const auction = buildAuction(Seat.North, ["1NT"]);
    expect(computeRole(auction.entries, Seat.North)).toBe("opener");
  });

  it("returns opener when no bids yet", () => {
    const auction = buildAuction(Seat.North, []);
    expect(computeRole(auction.entries, Seat.North)).toBe("opener");
  });

  it("returns responder when partner made the first bid", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    expect(computeRole(auction.entries, Seat.South)).toBe("responder");
  });

  it("returns competitive when opponent made the first bid", () => {
    const auction = buildAuction(Seat.East, ["1NT", "P"]);
    // South hasn't bid, East (opponent) opened
    expect(computeRole(auction.entries, Seat.South)).toBe("competitive");
  });

  it("returns rebidder when seat has already made a bid and is not the opener's first turn", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2H"]);
    // North opened 1NT and now bid 2H — rebidder
    expect(computeRole(auction.entries, Seat.North)).toBe("rebidder");
  });
});

// ─── evaluateProtocol ────────────────────────────────────────

describe("evaluateProtocol", () => {
  it("single-round protocol — trigger matches, returns correct BidNode", () => {
    const bidNode = staticBid("test-bid", 2, BidSuit.Clubs);
    const proto = protocol("test", [
      round("opening", {
        triggers: [semantic(partnerOpenedAt(1, BidSuit.NoTrump), {})],
        handTree: bidNode,
      }),
    ]);

    // North opens 1NT, Pass — South is responder at cursor 0
    const ctx = makeContext(["1NT", "P"], Seat.South, Seat.North);
    const result = evaluateProtocol(proto, ctx);

    expect(result.matched).toBe(bidNode);
    expect(result.matchedRounds).toHaveLength(1);
    expect(result.matchedRounds[0]!.round.name).toBe("opening");
  });

  it("single-round protocol — no trigger matches, returns null", () => {
    const bidNode = staticBid("test-bid", 2, BidSuit.Clubs);
    const proto = protocol("test", [
      round("opening", {
        triggers: [semantic(partnerOpenedAt(2, BidSuit.NoTrump), {})],
        handTree: bidNode,
      }),
    ]);

    // 1NT opening — trigger expects 2NT, won't match
    const ctx = makeContext(["1NT", "P"], Seat.South, Seat.North);
    const result = evaluateProtocol(proto, ctx);

    expect(result.matched).toBeNull();
    expect(result.matchedRounds).toHaveLength(0);
    expect(result.activeRound).toBeNull();
  });

  it("3-round protocol — full match, active round is last", () => {
    interface TestEst extends EstablishedContext {
      openingLevel?: number;
      majorShown?: string;
    }

    const finalBid = staticBid("final-bid", 4, BidSuit.Hearts);
    const proto = protocol<TestEst>("test", [
      round<TestEst>("opening", {
        triggers: [
          semantic<TestEst>(partnerOpenedAt(1, BidSuit.NoTrump), { openingLevel: 1 }),
        ],
        handTree: staticBid("ask", 2, BidSuit.Clubs),
      }),
      round<TestEst>("our-bid", {
        triggers: [
          semantic<TestEst>(auctionMatches(["1NT", "P", "2C", "P"]), {}),
        ],
        handTree: staticBid("wait", 2, BidSuit.Diamonds),
      }),
      round<TestEst>("response", {
        triggers: [
          semantic<TestEst>(auctionMatches(["1NT", "P", "2C", "P", "2H", "P"]), { majorShown: "hearts" }),
        ],
        handTree: finalBid,
      }),
    ]);

    const ctx = makeContext(
      ["1NT", "P", "2C", "P", "2H", "P"],
      Seat.South,
      Seat.North,
    );
    const result = evaluateProtocol(proto, ctx);

    expect(result.matched).toBe(finalBid);
    expect(result.matchedRounds).toHaveLength(3);
    expect(result.activeRound!.name).toBe("response");
    expect(result.established.openingLevel).toBe(1);
    expect(result.established.majorShown).toBe("hearts");
  });

  it("3-round protocol — partial match at round 2", () => {
    interface TestEst extends EstablishedContext {
      openingLevel?: number;
    }

    const round2Bid = staticBid("ask", 2, BidSuit.Clubs);
    const proto = protocol<TestEst>("test", [
      round<TestEst>("opening", {
        triggers: [
          semantic<TestEst>(partnerOpenedAt(1, BidSuit.NoTrump), { openingLevel: 1 }),
        ],
        handTree: round2Bid,
      }),
      round<TestEst>("our-bid", {
        triggers: [
          semantic<TestEst>(auctionMatches(["1NT", "P", "2C", "P"]), {}),
        ],
        handTree: round2Bid,
      }),
      round<TestEst>("response", {
        triggers: [
          semantic<TestEst>(auctionMatches(["1NT", "P", "2C", "P", "2H", "P"]), {}),
        ],
        handTree: staticBid("final", 4, BidSuit.Hearts),
      }),
    ]);

    // Only 4 entries — round 3 trigger can't match (not enough entries)
    const ctx = makeContext(["1NT", "P", "2C", "P"], Seat.South, Seat.North);
    const result = evaluateProtocol(proto, ctx);

    expect(result.matchedRounds).toHaveLength(2);
    expect(result.activeRound!.name).toBe("our-bid");
  });

  it("multi-variant trigger — correct variant selected", () => {
    interface TestEst extends EstablishedContext {
      openingLevel?: number;
    }

    const bid1NT = staticBid("after-1nt", 2, BidSuit.Clubs);
    const bid2NT = staticBid("after-2nt", 3, BidSuit.Clubs);

    const proto = protocol<TestEst>("test", [
      round<TestEst>("opening", {
        triggers: [
          semantic<TestEst>(partnerOpenedAt(1, BidSuit.NoTrump), { openingLevel: 1 }),
          semantic<TestEst>(partnerOpenedAt(2, BidSuit.NoTrump), { openingLevel: 2 }),
        ],
        handTree: (est) => est.openingLevel === 1 ? bid1NT : bid2NT,
      }),
    ]);

    // Test 1NT opening
    const ctx1 = makeContext(["1NT", "P"], Seat.South, Seat.North);
    const result1 = evaluateProtocol(proto, ctx1);
    expect(result1.matched).toBe(bid1NT);
    expect(result1.established.openingLevel).toBe(1);

    // Test 2NT opening
    const ctx2 = makeContext(["2NT", "P"], Seat.South, Seat.North);
    const result2 = evaluateProtocol(proto, ctx2);
    expect(result2.matched).toBe(bid2NT);
    expect(result2.established.openingLevel).toBe(2);
  });

  it("handTree as function receives accumulated established context", () => {
    interface TestEst extends EstablishedContext {
      openingLevel?: number;
    }

    let receivedContext: TestEst | null = null;
    const proto = protocol<TestEst>("test", [
      round<TestEst>("opening", {
        triggers: [
          semantic<TestEst>(partnerOpenedAt(1, BidSuit.NoTrump), { openingLevel: 1 }),
        ],
        handTree: (est) => {
          receivedContext = est;
          return staticBid("test", 2, BidSuit.Clubs);
        },
      }),
    ]);

    const ctx = makeContext(["1NT", "P"], Seat.South, Seat.North);
    evaluateProtocol(proto, ctx);

    expect(receivedContext).not.toBeNull();
    expect(receivedContext!.role).toBe("responder");
    expect(receivedContext!.openingLevel).toBe(1);
  });

  it("hand tree evaluates hand conditions correctly", () => {
    const handTree = handDecision(
      "hcp-check",
      hcpMin(10),
      staticBid("strong", 3, BidSuit.NoTrump),
      staticBid("weak", 2, BidSuit.NoTrump),
    );

    const proto = protocol("test", [
      round("opening", {
        triggers: [semantic(partnerOpenedAt(1, BidSuit.NoTrump), {})],
        handTree,
      }),
    ]);

    // Test hand has 13 HCP — should take the "strong" branch
    const ctx = makeContext(["1NT", "P"], Seat.South, Seat.North);
    const result = evaluateProtocol(proto, ctx);

    expect(result.matched!.name).toBe("strong");
    expect(result.handResult.path).toHaveLength(1);
    expect(result.handResult.path[0]!.passed).toBe(true);
  });

  it("returns handTreeRoot for sibling finder", () => {
    const handTree = handDecision(
      "hcp-check",
      hcpMin(10),
      staticBid("strong", 3, BidSuit.NoTrump),
      staticBid("weak", 2, BidSuit.NoTrump),
    );

    const proto = protocol("test", [
      round("opening", {
        triggers: [semantic(partnerOpenedAt(1, BidSuit.NoTrump), {})],
        handTree,
      }),
    ]);

    const ctx = makeContext(["1NT", "P"], Seat.South, Seat.North);
    const result = evaluateProtocol(proto, ctx);

    expect(result.handTreeRoot).toBe(handTree);
  });

  it("no auction entries at all — no rounds match", () => {
    const proto = protocol("test", [
      round("opening", {
        triggers: [semantic(partnerOpenedAt(1, BidSuit.NoTrump), {})],
        handTree: staticBid("test", 2, BidSuit.Clubs),
      }),
    ]);

    const h = testHand();
    const ctx = createBiddingContext({
      hand: h,
      auction: { entries: [], isComplete: false },
      seat: Seat.South,
      evaluation: evaluateHand(h),
    });
    const result = evaluateProtocol(proto, ctx);

    expect(result.matched).toBeNull();
    expect(result.matchedRounds).toHaveLength(0);
  });
});

// ─── validateProtocol ────────────────────────────────────────

describe("validateProtocol", () => {
  it("rejects protocol with zero rounds", () => {
    const proto = protocol("test", []);
    expect(() => validateProtocol(proto)).toThrow("zero rounds");
  });

  it("rejects round with zero triggers", () => {
    const proto = protocol("test", [
      round("empty", {
        triggers: [],
        handTree: staticBid("test", 2, BidSuit.Clubs),
      }),
    ]);
    expect(() => validateProtocol(proto)).toThrow("zero triggers");
  });

  it("rejects non-auction condition in trigger", () => {
    const handCond = alwaysTrue("hand-check", "hand");
    const proto = protocol("test", [
      round("bad", {
        triggers: [
          // any cast needed because TS would normally catch this
          semantic(handCond as unknown as AuctionCondition, {}),
        ],
        handTree: staticBid("test", 2, BidSuit.Clubs),
      }),
    ]);
    expect(() => validateProtocol(proto)).toThrow('category "hand"');
  });

  it("accepts valid protocol", () => {
    const proto = protocol("test", [
      round("opening", {
        triggers: [semantic(partnerOpenedAt(1, BidSuit.NoTrump), {})],
        handTree: staticBid("test", 2, BidSuit.Clubs),
      }),
    ]);
    expect(() => validateProtocol(proto)).not.toThrow();
  });

  it("accepts valid protocol with seatFilter", () => {
    const proto = protocol("test", [
      round("opening", {
        triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
        handTree: staticBid("test", 2, BidSuit.Clubs),
        seatFilter: isResponder(),
      }),
    ]);
    expect(() => validateProtocol(proto)).not.toThrow();
  });

  it("rejects non-auction seatFilter", () => {
    const handCond = alwaysTrue("hand-check", "hand");
    const proto = protocol("test", [
      round("bad", {
        triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
        handTree: staticBid("test", 2, BidSuit.Clubs),
        seatFilter: handCond as unknown as AuctionCondition,
      }),
    ]);
    expect(() => validateProtocol(proto)).toThrow('category "hand"');
  });
});

// ─── Milestone condition factories ──────────────────────────

describe("milestone conditions", () => {
  it("bidMade detects specific level/strain", () => {
    const ctx = makeContext(["1NT", "P", "2C", "P"], Seat.South, Seat.North);
    expect(bidMade(1, BidSuit.NoTrump).test(ctx)).toBe(true);
    expect(bidMade(2, BidSuit.Clubs).test(ctx)).toBe(true);
    expect(bidMade(2, BidSuit.Hearts).test(ctx)).toBe(false);
  });

  it("doubleMade detects a double", () => {
    const ctx = makeContext(["1NT", "X", "P"], Seat.South, Seat.East);
    expect(doubleMade().test(ctx)).toBe(true);

    const ctx2 = makeContext(["1NT", "P"], Seat.South, Seat.North);
    expect(doubleMade().test(ctx2)).toBe(false);
  });

  it("bidMadeAtLevel detects any bid at a level", () => {
    const ctx = makeContext(["1NT", "P", "2C", "P"], Seat.South, Seat.North);
    expect(bidMadeAtLevel(1).test(ctx)).toBe(true);
    expect(bidMadeAtLevel(2).test(ctx)).toBe(true);
    expect(bidMadeAtLevel(3).test(ctx)).toBe(false);
  });
});

// ─── Seat-specific condition factories ──────────────────────

describe("seat-specific conditions", () => {
  it("opponentOpenedAt detects opponent's opening bid", () => {
    // East opens 1NT, South is competitive
    const ctx = makeContext(["1NT", "P"], Seat.South, Seat.East);
    expect(opponentOpenedAt(1, BidSuit.NoTrump).test(ctx)).toBe(true);
    expect(opponentOpenedAt(2, BidSuit.NoTrump).test(ctx)).toBe(false);
  });

  it("opponentOpenedAt returns false when partner opened", () => {
    // North opens 1NT, South is responder
    const ctx = makeContext(["1NT", "P"], Seat.South, Seat.North);
    expect(opponentOpenedAt(1, BidSuit.NoTrump).test(ctx)).toBe(false);
  });

  it("seatHasActed detects any previous action", () => {
    // South has passed (acted)
    const ctx = makeContext(["1NT", "P", "2C"], Seat.South, Seat.East);
    expect(seatHasActed().test(ctx)).toBe(true);

    // South hasn't acted yet
    const ctx2 = makeContext(["1NT"], Seat.South, Seat.East);
    expect(seatHasActed().test(ctx2)).toBe(false);
  });

  it("seatDoubled detects seat's double", () => {
    // South doubled: 1NT-X (East opens, South doubles)
    const ctx = makeContext(["1NT", "X", "P"], Seat.South, Seat.East);
    expect(seatDoubled().test(ctx)).toBe(true);

    // South bid, didn't double
    const ctx2 = makeContext(["1NT", "2C", "P"], Seat.South, Seat.East);
    expect(seatDoubled().test(ctx2)).toBe(false);
  });

  it("seatBidAt detects seat's specific bid", () => {
    // South bid 2C: 1NT-2C (East opens, South overcalls)
    const ctx = makeContext(["1NT", "2C", "P"], Seat.South, Seat.East);
    expect(seatBidAt(2, BidSuit.Clubs).test(ctx)).toBe(true);
    expect(seatBidAt(2, BidSuit.Hearts).test(ctx)).toBe(false);
  });

  it("partnerLastBidAtLevel detects partner's last bid level", () => {
    // North opened 1NT, South responds
    const ctx = makeContext(["1NT", "P"], Seat.South, Seat.North);
    expect(partnerLastBidAtLevel(1).test(ctx)).toBe(true);
    expect(partnerLastBidAtLevel(2).test(ctx)).toBe(false);
  });

  it("partnerDoubled detects partner's most recent action being a double", () => {
    // North doubled: 1NT(E)-P(S)-X(N) — but need correct seats
    // East opens 1NT, South passes, West passes, North doubles
    const ctx = makeContext(["1NT", "P", "P", "X"], Seat.South, Seat.East);
    expect(partnerDoubled().test(ctx)).toBe(true);
  });
});

// ─── seatFilter in evaluateProtocol ─────────────────────────

describe("evaluateProtocol — seatFilter", () => {
  it("seatFilter passes — round becomes active", () => {
    const bidNode = staticBid("test-bid", 2, BidSuit.Clubs);
    const proto = protocol("test", [
      round("opening", {
        triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
        handTree: bidNode,
        seatFilter: isResponder(),
      }),
    ]);

    // South is responder (North opened)
    const ctx = makeContext(["1NT", "P"], Seat.South, Seat.North);
    const result = evaluateProtocol(proto, ctx);

    expect(result.matched).toBe(bidNode);
    expect(result.activeRound!.name).toBe("opening");
  });

  it("seatFilter fails — cursor advances but activeRound not set", () => {
    const bidNode = staticBid("test-bid", 2, BidSuit.Clubs);
    const proto = protocol("test", [
      round("opening", {
        triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
        handTree: bidNode,
        seatFilter: isOpener(), // South is NOT opener (North opened)
      }),
    ]);

    const ctx = makeContext(["1NT", "P"], Seat.South, Seat.North);
    const result = evaluateProtocol(proto, ctx);

    // Trigger matched but seatFilter failed, so no active round
    expect(result.matched).toBeNull();
    expect(result.activeRound).toBeNull();
    expect(result.matchedRounds).toHaveLength(1); // Round was still matched
  });

  it("multi-round with seatFilter — skips rounds for wrong seat", () => {
    interface TestEst extends EstablishedContext {
      opening?: boolean;
    }

    const round1Bid = staticBid("ask", 2, BidSuit.Clubs);
    const round2Bid = staticBid("response", 2, BidSuit.Hearts);

    const proto = protocol<TestEst>("test", [
      round<TestEst>("nt-opening", {
        triggers: [semantic<TestEst>(bidMade(1, BidSuit.NoTrump), { opening: true })],
        handTree: round1Bid,
        seatFilter: isResponder(),
      }),
      round<TestEst>("stayman-ask", {
        triggers: [semantic<TestEst>(bidMade(2, BidSuit.Clubs), {})],
        handTree: round2Bid,
        seatFilter: isOpener(),
      }),
    ]);

    // Opener at [1NT, P, 2C, P] — R1 seatFilter fails (isResponder), R2 passes (isOpener)
    const ctx = makeContext(["1NT", "P", "2C", "P"], Seat.North, Seat.North);
    const result = evaluateProtocol(proto, ctx);

    expect(result.matched).toBe(round2Bid);
    expect(result.activeRound!.name).toBe("stayman-ask");
    expect(result.matchedRounds).toHaveLength(2);
  });

  it("responder sees correct active round in 3-round Stayman-like protocol", () => {
    const finalBid = staticBid("rebid", 4, BidSuit.Hearts);
    const proto = protocol("test", [
      round("nt-opening", {
        triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
        handTree: staticBid("ask", 2, BidSuit.Clubs),
        seatFilter: isResponder(),
      }),
      round("stayman-ask", {
        triggers: [semantic(bidMade(2, BidSuit.Clubs), {})],
        handTree: staticBid("response", 2, BidSuit.Hearts),
        seatFilter: isOpener(),
      }),
      round("opener-response", {
        triggers: [semantic(bidMade(2, BidSuit.Hearts), {})],
        handTree: finalBid,
        seatFilter: isResponder(),
      }),
    ]);

    // South (responder) at full auction [1NT, P, 2C, P, 2H, P]
    const ctx = makeContext(
      ["1NT", "P", "2C", "P", "2H", "P"],
      Seat.South,
      Seat.North,
    );
    const result = evaluateProtocol(proto, ctx);

    expect(result.matched).toBe(finalBid);
    expect(result.activeRound!.name).toBe("opener-response");
    expect(result.matchedRounds).toHaveLength(3);
  });
});
