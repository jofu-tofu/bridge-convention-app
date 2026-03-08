// Phase 1: TriggerDescriptor overlap/subsumption unit tests

import { describe, test, expect } from "vitest";
import { BidSuit } from "../../../engine/types";
import {
  descriptorOverlaps,
  descriptorSubsumes,
  descriptorsDisjoint,
} from "../../core/trigger-descriptor";
import type { TriggerDescriptor } from "../../core/trigger-descriptor";

// ─── Helper constructors ─────────────────────────────────────

function bidMade(level: number, strain: BidSuit, actor: "any" | "partner" | "opponent" = "any"): TriggerDescriptor {
  return { kind: "bid-made", level, strain, actor };
}

function bidAtLevel(level: number, actor: "any" | "partner" | "opponent" = "any"): TriggerDescriptor {
  return { kind: "bid-at-level", level, actor };
}

function cursorReached(): TriggerDescriptor {
  return { kind: "cursor-reached" };
}

function opaque(): TriggerDescriptor {
  return { kind: "opaque" };
}

function role(r: "opener" | "responder"): TriggerDescriptor {
  return { kind: "role", role: r };
}

function biddingRound(n: number): TriggerDescriptor {
  return { kind: "bidding-round", n };
}

function compoundOr(...children: TriggerDescriptor[]): TriggerDescriptor {
  return { kind: "compound-or", children };
}

function compoundAnd(...children: TriggerDescriptor[]): TriggerDescriptor {
  return { kind: "compound-and", children };
}

function _negation(child: TriggerDescriptor): TriggerDescriptor {
  return { kind: "negation", child };
}

// ─── descriptorOverlaps ──────────────────────────────────────

describe("descriptorOverlaps", () => {
  test("bid-made(1, NT, any) overlaps bid-made(1, NT, partner)", () => {
    expect(descriptorOverlaps(
      bidMade(1, BidSuit.NoTrump, "any"),
      bidMade(1, BidSuit.NoTrump, "partner"),
    )).toBe(true);
  });

  test("bid-made(1, NT, partner) does NOT overlap bid-made(1, NT, opponent)", () => {
    expect(descriptorOverlaps(
      bidMade(1, BidSuit.NoTrump, "partner"),
      bidMade(1, BidSuit.NoTrump, "opponent"),
    )).toBe(false);
  });

  test("bid-at-level(3) overlaps bid-made(3, C, any)", () => {
    expect(descriptorOverlaps(
      bidAtLevel(3),
      bidMade(3, BidSuit.Clubs, "any"),
    )).toBe(true);
  });

  test("bid-made(1, NT) does NOT overlap bid-made(2, C)", () => {
    expect(descriptorOverlaps(
      bidMade(1, BidSuit.NoTrump),
      bidMade(2, BidSuit.Clubs),
    )).toBe(false);
  });

  test("cursor-reached overlaps everything", () => {
    expect(descriptorOverlaps(cursorReached(), bidMade(1, BidSuit.NoTrump))).toBe(true);
    expect(descriptorOverlaps(cursorReached(), role("opener"))).toBe(true);
    expect(descriptorOverlaps(cursorReached(), biddingRound(1))).toBe(true);
  });

  test("cursor-reached does NOT overlap opaque", () => {
    expect(descriptorOverlaps(cursorReached(), opaque())).toBe(false);
  });

  test("opaque never overlaps anything", () => {
    expect(descriptorOverlaps(opaque(), bidMade(1, BidSuit.NoTrump))).toBe(false);
    expect(descriptorOverlaps(opaque(), opaque())).toBe(false);
  });

  test("undefined descriptor never overlaps", () => {
    expect(descriptorOverlaps(undefined, bidMade(1, BidSuit.NoTrump))).toBe(false);
    expect(descriptorOverlaps(bidMade(1, BidSuit.NoTrump), undefined)).toBe(false);
    expect(descriptorOverlaps(undefined, undefined)).toBe(false);
  });

  test("or(bid-made(1,H), bid-made(1,S)) overlaps bid-made(1,H)", () => {
    expect(descriptorOverlaps(
      compoundOr(bidMade(1, BidSuit.Hearts), bidMade(1, BidSuit.Spades)),
      bidMade(1, BidSuit.Hearts),
    )).toBe(true);
  });

  test("or(bid-made(1,H), bid-made(1,S)) does NOT overlap bid-made(1,C)", () => {
    expect(descriptorOverlaps(
      compoundOr(bidMade(1, BidSuit.Hearts), bidMade(1, BidSuit.Spades)),
      bidMade(1, BidSuit.Clubs),
    )).toBe(false);
  });

  test("and(role(opener), biddingRound(2)) does NOT overlap biddingRound(1)", () => {
    expect(descriptorOverlaps(
      compoundAnd(role("opener"), biddingRound(2)),
      biddingRound(1),
    )).toBe(false);
  });

  test("and(role(opener), biddingRound(1)) overlaps biddingRound(1)", () => {
    expect(descriptorOverlaps(
      compoundAnd(role("opener"), biddingRound(1)),
      biddingRound(1),
    )).toBe(true);
  });

  test("role(opener) overlaps role(opener)", () => {
    expect(descriptorOverlaps(role("opener"), role("opener"))).toBe(true);
  });

  test("role(opener) does NOT overlap role(responder)", () => {
    expect(descriptorOverlaps(role("opener"), role("responder"))).toBe(false);
  });

  test("biddingRound(1) overlaps biddingRound(1)", () => {
    expect(descriptorOverlaps(biddingRound(1), biddingRound(1))).toBe(true);
  });

  test("biddingRound(1) does NOT overlap biddingRound(2)", () => {
    expect(descriptorOverlaps(biddingRound(1), biddingRound(2))).toBe(false);
  });

  test("compound-and with internally disjoint children does NOT overlap anything", () => {
    // and(role(opener), role(responder)) is internally contradictory
    expect(descriptorOverlaps(
      compoundAnd(role("opener"), role("responder")),
      role("opener"),
    )).toBe(false);
  });
});

// ─── descriptorSubsumes ──────────────────────────────────────

describe("descriptorSubsumes", () => {
  test("cursor-reached subsumes everything", () => {
    expect(descriptorSubsumes(cursorReached(), bidMade(1, BidSuit.NoTrump))).toBe(true);
    expect(descriptorSubsumes(cursorReached(), role("opener"))).toBe(true);
    expect(descriptorSubsumes(cursorReached(), biddingRound(3))).toBe(true);
    expect(descriptorSubsumes(cursorReached(), cursorReached())).toBe(true);
  });

  test("bid-at-level(3) subsumes bid-made(3, C, any)", () => {
    expect(descriptorSubsumes(bidAtLevel(3), bidMade(3, BidSuit.Clubs, "any"))).toBe(true);
  });

  test("bid-at-level(3, any) subsumes bid-made(3, H, partner)", () => {
    expect(descriptorSubsumes(bidAtLevel(3, "any"), bidMade(3, BidSuit.Hearts, "partner"))).toBe(true);
  });

  test("bid-made(1, NT, any) does NOT subsume bid-at-level(1)", () => {
    expect(descriptorSubsumes(bidMade(1, BidSuit.NoTrump, "any"), bidAtLevel(1))).toBe(false);
  });

  test("bid-made(1, NT, any) subsumes bid-made(1, NT, partner)", () => {
    expect(descriptorSubsumes(
      bidMade(1, BidSuit.NoTrump, "any"),
      bidMade(1, BidSuit.NoTrump, "partner"),
    )).toBe(true);
  });

  test("bid-made(1, NT, partner) does NOT subsume bid-made(1, NT, any)", () => {
    expect(descriptorSubsumes(
      bidMade(1, BidSuit.NoTrump, "partner"),
      bidMade(1, BidSuit.NoTrump, "any"),
    )).toBe(false);
  });

  test("opaque never subsumes and is never subsumed", () => {
    expect(descriptorSubsumes(opaque(), bidMade(1, BidSuit.NoTrump))).toBe(false);
    expect(descriptorSubsumes(bidMade(1, BidSuit.NoTrump), opaque())).toBe(false);
    expect(descriptorSubsumes(cursorReached(), opaque())).toBe(false);
  });

  test("undefined never subsumes", () => {
    expect(descriptorSubsumes(undefined, bidMade(1, BidSuit.NoTrump))).toBe(false);
    expect(descriptorSubsumes(bidMade(1, BidSuit.NoTrump), undefined)).toBe(false);
  });

  test("or(bid-made(1,H), bid-made(1,S)) subsumes bid-made(1,H)", () => {
    expect(descriptorSubsumes(
      compoundOr(bidMade(1, BidSuit.Hearts), bidMade(1, BidSuit.Spades)),
      bidMade(1, BidSuit.Hearts),
    )).toBe(true);
  });

  test("bid-made(1,H) does NOT subsume or(bid-made(1,H), bid-made(1,S))", () => {
    expect(descriptorSubsumes(
      bidMade(1, BidSuit.Hearts),
      compoundOr(bidMade(1, BidSuit.Hearts), bidMade(1, BidSuit.Spades)),
    )).toBe(false);
  });

  test("same role subsumes same role", () => {
    expect(descriptorSubsumes(role("opener"), role("opener"))).toBe(true);
  });

  test("different role does NOT subsume", () => {
    expect(descriptorSubsumes(role("opener"), role("responder"))).toBe(false);
  });
});

// ─── descriptorsDisjoint ─────────────────────────────────────

describe("descriptorsDisjoint", () => {
  test("role(opener) disjoint from role(responder)", () => {
    expect(descriptorsDisjoint(role("opener"), role("responder"))).toBe(true);
  });

  test("role(opener) NOT disjoint from role(opener)", () => {
    expect(descriptorsDisjoint(role("opener"), role("opener"))).toBe(false);
  });

  test("biddingRound(1) disjoint from biddingRound(2)", () => {
    expect(descriptorsDisjoint(biddingRound(1), biddingRound(2))).toBe(true);
  });

  test("biddingRound(1) NOT disjoint from biddingRound(1)", () => {
    expect(descriptorsDisjoint(biddingRound(1), biddingRound(1))).toBe(false);
  });

  test("bid-made(1,NT) disjoint from bid-made(2,C)", () => {
    expect(descriptorsDisjoint(
      bidMade(1, BidSuit.NoTrump),
      bidMade(2, BidSuit.Clubs),
    )).toBe(true);
  });

  test("bid-made(1,NT) NOT disjoint from bid-made(1,NT)", () => {
    expect(descriptorsDisjoint(
      bidMade(1, BidSuit.NoTrump),
      bidMade(1, BidSuit.NoTrump),
    )).toBe(false);
  });

  test("no-prior-bid disjoint from role(responder)", () => {
    expect(descriptorsDisjoint(
      { kind: "no-prior-bid" },
      role("responder"),
    )).toBe(true);
  });

  test("undefined is NOT disjoint (conservative)", () => {
    expect(descriptorsDisjoint(undefined, role("opener"))).toBe(false);
  });

  test("opaque is NOT disjoint (conservative)", () => {
    expect(descriptorsDisjoint(opaque(), role("opener"))).toBe(false);
  });

  test("cursor-reached is NOT disjoint from anything", () => {
    expect(descriptorsDisjoint(cursorReached(), bidMade(1, BidSuit.NoTrump))).toBe(false);
  });
});
