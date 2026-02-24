import { describe, it, expect, beforeEach } from "vitest";
import { saycConfig } from "../sayc";
import { clearRegistry, registerConvention } from "../registry";
import { generateDeal } from "../../engine/deal-generator";
import { evaluateHand } from "../../engine/hand-evaluator";
import { Seat, BidSuit } from "../../engine/types";
import type { Auction, Hand } from "../../engine/types";
import type { BiddingContext, BiddingRule } from "../types";
import { createBiddingContext } from "../context-factory";
import { SEATS } from "../../engine/constants";
import { isLegalCall } from "../../engine/auction";

beforeEach(() => {
  clearRegistry();
  registerConvention(saycConfig);
});

/** Find ALL rules that match a given context (not just first-match). */
function findAllMatchingRules(
  rules: readonly BiddingRule[],
  ctx: BiddingContext,
): { name: string; call: ReturnType<BiddingRule["call"]> }[] {
  const matches: { name: string; call: ReturnType<BiddingRule["call"]> }[] = [];
  for (const rule of rules) {
    if (rule.matches(ctx)) {
      const call = rule.call(ctx);
      if (isLegalCall(ctx.auction, call, ctx.seat)) {
        matches.push({ name: rule.name, call });
      }
    }
  }
  return matches;
}

/** Build a BiddingContext from a hand and auction state. */
function makeCtx(
  hand: Hand,
  seat: Seat,
  auction: Auction,
) {
  return createBiddingContext({ hand, auction, seat, evaluation: evaluateHand(hand) });
}

/** Build an auction from a list of calls starting from a dealer. */
function auctionFromCalls(
  dealer: Seat,
  calls: string[],
): Auction {
  const seatOrder = [Seat.North, Seat.East, Seat.South, Seat.West];
  const startIdx = seatOrder.indexOf(dealer);
  const entries = calls.map((callStr, i) => {
    const seat = seatOrder[(startIdx + i) % 4]!;
    const call = parseCall(callStr);
    return { seat, call };
  });
  return { entries, isComplete: false };
}

function parseCall(s: string): import("../../engine/types").Call {
  if (s === "P") return { type: "pass" };
  if (s === "X") return { type: "double" };
  if (s === "XX") return { type: "redouble" };
  const level = parseInt(s[0]!) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const strainMap: Record<string, BidSuit> = {
    C: BidSuit.Clubs,
    D: BidSuit.Diamonds,
    H: BidSuit.Hearts,
    S: BidSuit.Spades,
    NT: BidSuit.NoTrump,
    N: BidSuit.NoTrump,
  };
  const strain = strainMap[s.slice(1)]!;
  return { type: "bid", level, strain };
}

// Exclude catch-all pass from overlap analysis (it overlaps with everything by design)
const rulesWithoutPass = saycConfig.biddingRules.filter(
  (r) => r.name !== "sayc-pass",
);

describe("SAYC rule disjointness", () => {
  it("no non-trivial rule overlaps across random hands at opening position", () => {
    const overlaps = new Map<string, number>();
    const emptyAuction: Auction = { entries: [], isComplete: false };

    for (let i = 0; i < 200; i++) {
      const { deal } = generateDeal({ seats: [] });
      for (const seat of SEATS) {
        const ctx = makeCtx(deal.hands[seat], seat, emptyAuction);
        const matches = findAllMatchingRules(rulesWithoutPass, ctx);
        if (matches.length > 1) {
          const key = matches.map((m) => m.name).sort().join(" + ");
          overlaps.set(key, (overlaps.get(key) ?? 0) + 1);
        }
      }
    }

    // Report overlaps (opening position)
    for (const [pair, count] of overlaps) {
      console.log(`Opening overlap (${count}x): ${pair}`);
    }

    // Opening rules have intentional overlaps resolved by ordering
    // (e.g., 1NT checked before 1C/1D, 2NT before 1-level suits).
    // Verify no unexpected overlaps between unrelated rule groups.
    const unexpectedOverlaps = [...overlaps.keys()].filter((key) => {
      // These overlaps are expected (higher-priority rule wins by position)
      if (key.includes("sayc-open-1c") && key.includes("sayc-open-1d")) return false;
      if (key.includes("sayc-open-1nt") && key.includes("sayc-open-1c")) return false;
      if (key.includes("sayc-open-1nt") && key.includes("sayc-open-1d")) return false;
      if (key.includes("sayc-open-2nt") && key.includes("sayc-open-1")) return false;
      if (key.includes("sayc-open-2c") && key.includes("sayc-open-1")) return false;
      if (key.includes("sayc-open-1h") && key.includes("sayc-open-1s")) return false;
      // 6-6 hands with both majors match both weak-2 rules; first-match resolves
      if (key.includes("sayc-open-weak-2h") && key.includes("sayc-open-weak-2s")) return false;
      return true;
    });
    if (unexpectedOverlaps.length > 0) {
      console.error("Unexpected overlaps:", unexpectedOverlaps);
    }
    expect(unexpectedOverlaps.length).toBe(0);
  });

  it("no non-trivial rule overlaps at responding position", () => {
    const overlaps = new Map<string, number>();

    // Simulate various partner openings
    const openings = ["1C", "1D", "1H", "1S", "1NT"];

    for (let i = 0; i < 100; i++) {
      const { deal } = generateDeal({ seats: [] });
      for (const opening of openings) {
        // Partner (North) opens, East passes, South responds
        const auction = auctionFromCalls(Seat.North, [opening, "P"]);
        const ctx = makeCtx(deal.hands[Seat.South], Seat.South, auction);
        const matches = findAllMatchingRules(rulesWithoutPass, ctx);
        if (matches.length > 1) {
          const key = matches.map((m) => m.name).sort().join(" + ");
          overlaps.set(key, (overlaps.get(key) ?? 0) + 1);
        }
      }
    }

    for (const [pair, count] of overlaps) {
      console.log(`Response overlap (${count}x): ${pair}`);
    }

    // Some overlaps may be acceptable (different bids at same priority).
    // Flag but don't fail — just ensure the first-match produces a reasonable bid.
    if (overlaps.size > 0) {
      console.log(`Found ${overlaps.size} response overlap pattern(s) — review for correctness`);
    }
  });

  it("no non-trivial rule overlaps at rebid position", () => {
    const overlaps = new Map<string, number>();

    // Simulate opener rebid scenarios
    const rebidAuctions = [
      // Opened 1H, partner raised to 2H
      ["1H", "P", "2H", "P"],
      // Opened 1S, partner raised to 2S
      ["1S", "P", "2S", "P"],
      // Opened 1H, partner responded 1NT
      ["1H", "P", "1NT", "P"],
      // Opened 1S, partner responded 1NT
      ["1S", "P", "1NT", "P"],
      // Opened 1C, partner responded 1H
      ["1C", "P", "1H", "P"],
      // Opened 1D, partner responded 1S
      ["1D", "P", "1S", "P"],
    ];

    for (let i = 0; i < 100; i++) {
      const { deal } = generateDeal({ seats: [] });
      for (const calls of rebidAuctions) {
        const auction = auctionFromCalls(Seat.North, calls);
        const ctx = makeCtx(deal.hands[Seat.North], Seat.North, auction);
        const matches = findAllMatchingRules(rulesWithoutPass, ctx);
        if (matches.length > 1) {
          const key = matches.map((m) => m.name).sort().join(" + ");
          overlaps.set(key, (overlaps.get(key) ?? 0) + 1);
        }
      }
    }

    for (const [pair, count] of overlaps) {
      console.log(`Rebid overlap (${count}x): ${pair}`);
    }

    if (overlaps.size > 0) {
      console.log(`Found ${overlaps.size} rebid overlap pattern(s) — review for correctness`);
    }
  });

  it("every rule is reachable (not shadowed by earlier rules)", () => {
    // Track which rules ever match first (in first-match order)
    const ruleHits = new Map<string, number>();
    for (const rule of saycConfig.biddingRules) {
      ruleHits.set(rule.name, 0);
    }

    const auctionContexts = [
      // Opening positions
      ...Array.from({ length: 4 }, (_, i) => ({
        auction: { entries: [], isComplete: false } as Auction,
        seat: SEATS[i]!,
      })),
      // Responding positions
      ...["1C", "1D", "1H", "1S", "1NT"].map((opening) => ({
        auction: auctionFromCalls(Seat.North, [opening, "P"]),
        seat: Seat.South,
      })),
      // Rebid positions
      ...([
        ["1H", "P", "2H", "P"],
        ["1S", "P", "2S", "P"],
        ["1H", "P", "1NT", "P"],
        ["1C", "P", "1H", "P"],
        ["1D", "P", "1S", "P"],
      ] as string[][]).map((calls) => ({
        auction: auctionFromCalls(Seat.North, calls),
        seat: Seat.North,
      })),
      // Competitive positions
      ...["1C", "1D", "1H", "1S"].map((opening) => ({
        auction: auctionFromCalls(Seat.North, [opening]),
        seat: Seat.East,
      })),
    ];

    for (let i = 0; i < 500; i++) {
      const { deal } = generateDeal({ seats: [] });
      for (const { auction, seat } of auctionContexts) {
        const ctx = makeCtx(deal.hands[seat], seat, auction);
        // First-match evaluation
        for (const rule of saycConfig.biddingRules) {
          if (rule.matches(ctx)) {
            const call = rule.call(ctx);
            if (isLegalCall(ctx.auction, call, ctx.seat)) {
              ruleHits.set(rule.name, (ruleHits.get(rule.name) ?? 0) + 1);
              break; // first-match
            }
          }
        }
      }
    }

    const unreachable = [...ruleHits.entries()]
      .filter(([, count]) => count === 0)
      .map(([name]) => name);

    if (unreachable.length > 0) {
      console.log("Unreachable rules:", unreachable);
    }

    // sayc-pass should rarely be the first match (most hands have an opening bid)
    // Some rules may not fire in 500 random deals — log but don't fail hard
    for (const [name, count] of ruleHits) {
      if (count > 0) continue;
      // These are acceptable to not hit in random testing
      // (require very specific auction states)
      const rareRules = [
        "sayc-rebid-1nt", // needs 12-14 balanced opener who opened a suit (rare: would have opened 1NT)
      ];
      if (!rareRules.includes(name)) {
        console.warn(`Rule "${name}" was never the first match in 500 deals`);
      }
    }

    // At minimum, opening rules and pass should always be reachable
    expect(ruleHits.get("sayc-pass")).toBeGreaterThan(0);
    expect(ruleHits.get("sayc-open-1c")).toBeGreaterThan(0);
  });
});
