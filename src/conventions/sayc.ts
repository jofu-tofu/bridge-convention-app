import type { ConventionConfig, BiddingContext } from "./types";
import { ConventionCategory } from "./types";
import type { Call, ContractBid } from "../engine/types";
import { BidSuit } from "../engine/types";
import { partnerSeat } from "../engine/constants";
import {
  conditionedRule,
  hcpMin,
  hcpRange,
  suitMin,
  suitBelow,
  isOpener,
  isResponder,
  partnerOpened,
  opponentBid,
  isBalanced,
  noFiveCardMajor,
  longerMajor,
  noPriorBid,
  not,
} from "./conditions";

// ─── Helpers ─────────────────────────────────────────────────

/** Find the strain of the first contract bid by partner. */
function partnerOpeningStrain(ctx: BiddingContext): BidSuit | null {
  const partner = partnerSeat(ctx.seat);
  for (const entry of ctx.auction.entries) {
    if (entry.call.type === "bid" && entry.seat === partner) {
      return entry.call.strain;
    }
  }
  return null;
}

/** Find the last contract bid in the auction by any player. */
function lastBid(ctx: BiddingContext): ContractBid | null {
  for (let i = ctx.auction.entries.length - 1; i >= 0; i--) {
    const call = ctx.auction.entries[i]!.call;
    if (call.type === "bid") return call;
  }
  return null;
}

/** Make a contract bid Call. */
function bid(
  level: ContractBid["level"],
  strain: BidSuit,
): Call {
  return { type: "bid", level, strain };
}

const pass: Call = { type: "pass" };

/** Canonical denomination ordering for bid legality checks. */
const STRAIN_ORDER: Record<string, number> = {
  [BidSuit.Clubs]: 0,
  [BidSuit.Diamonds]: 1,
  [BidSuit.Hearts]: 2,
  [BidSuit.Spades]: 3,
  [BidSuit.NoTrump]: 4,
};

/** Check if a bid at (level, strain) is higher than an existing bid. */
function bidIsHigher(
  level: number,
  strain: BidSuit,
  existing: ContractBid,
): boolean {
  if (level > existing.level) return true;
  if (level === existing.level) {
    return STRAIN_ORDER[strain]! > STRAIN_ORDER[existing.strain]!;
  }
  return false;
}

// ─── SAYC Convention ─────────────────────────────────────────

export const saycConfig: ConventionConfig = {
  id: "sayc",
  name: "Standard American Yellow Card",
  description: "Standard American bidding system for opponent AI",
  category: ConventionCategory.Constructive,
  internal: true,
  dealConstraints: {
    seats: [], // No specific constraints — SAYC works with any hand
  },
  defaultAuction: () => undefined,
  biddingRules: [
    // ─── Opening bids (highest priority for openers) ───────────

    // 2C: 22+ HCP (check before NT openings)
    conditionedRule({
      name: "sayc-open-2c",
      conditions: [noPriorBid(), isOpener(), hcpMin(22)],
      call: () => bid(2, BidSuit.Clubs),
    }),

    // 2NT: 20-21 HCP, balanced (before 1NT to avoid 1-level suit catch-all)
    conditionedRule({
      name: "sayc-open-2nt",
      conditions: [noPriorBid(), isOpener(), hcpRange(20, 21), isBalanced()],
      call: () => bid(2, BidSuit.NoTrump),
    }),

    // 1NT: 15-17 HCP, balanced, no 5-card major
    conditionedRule({
      name: "sayc-open-1nt",
      conditions: [
        noPriorBid(),
        isOpener(),
        hcpRange(15, 17),
        isBalanced(),
        noFiveCardMajor(),
      ],
      call: () => bid(1, BidSuit.NoTrump),
    }),

    // 1S: 12+ HCP, 5+ spades (spades >= hearts)
    conditionedRule({
      name: "sayc-open-1s",
      conditions: [
        noPriorBid(),
        isOpener(),
        hcpMin(12),
        longerMajor(0, "spades"),
      ],
      call: () => bid(1, BidSuit.Spades),
    }),

    // 1H: 12+ HCP, 5+ hearts
    conditionedRule({
      name: "sayc-open-1h",
      conditions: [
        noPriorBid(),
        isOpener(),
        hcpMin(12),
        suitMin(1, "hearts", 5),
      ],
      call: () => bid(1, BidSuit.Hearts),
    }),

    // 1D: 12+ HCP, 4+ diamonds (longer minor or equal)
    conditionedRule({
      name: "sayc-open-1d",
      conditions: [
        noPriorBid(),
        isOpener(),
        hcpMin(12),
        suitBelow(0, "spades", 5),
        suitBelow(1, "hearts", 5),
        suitMin(2, "diamonds", 4),
      ],
      call: () => bid(1, BidSuit.Diamonds),
    }),

    // 1C: 12+ HCP, 3+ clubs (catch-all minor opening)
    conditionedRule({
      name: "sayc-open-1c",
      conditions: [
        noPriorBid(),
        isOpener(),
        hcpMin(12),
        suitBelow(0, "spades", 5),
        suitBelow(1, "hearts", 5),
        suitMin(3, "clubs", 3),
      ],
      call: () => bid(1, BidSuit.Clubs),
    }),

    // Weak 2H: 5-11 HCP, 6+ hearts
    conditionedRule({
      name: "sayc-open-weak-2h",
      conditions: [
        noPriorBid(),
        isOpener(),
        hcpRange(5, 11),
        suitMin(1, "hearts", 6),
      ],
      call: () => bid(2, BidSuit.Hearts),
    }),

    // Weak 2S: 5-11 HCP, 6+ spades
    conditionedRule({
      name: "sayc-open-weak-2s",
      conditions: [
        noPriorBid(),
        isOpener(),
        hcpRange(5, 11),
        suitMin(0, "spades", 6),
      ],
      call: () => bid(2, BidSuit.Spades),
    }),

    // Weak 2D: 5-11 HCP, 6+ diamonds
    conditionedRule({
      name: "sayc-open-weak-2d",
      conditions: [
        noPriorBid(),
        isOpener(),
        hcpRange(5, 11),
        suitMin(2, "diamonds", 6),
      ],
      call: () => bid(2, BidSuit.Diamonds),
    }),

    // ─── Responses to 1NT ──────────────────────────────────────

    // Stayman after partner's 1NT: 8+ HCP, 4-card major
    conditionedRule({
      name: "sayc-respond-1nt-stayman",
      conditions: [
        isResponder(),
        partnerOpened(BidSuit.NoTrump),
        hcpMin(8),
        // Must have at least one 4-card major
        {
          name: "has-4-card-major",
          test(ctx) {
            return (
              ctx.evaluation.shape[0]! >= 4 || ctx.evaluation.shape[1]! >= 4
            );
          },
          describe(ctx) {
            const s = ctx.evaluation.shape[0]!;
            const h = ctx.evaluation.shape[1]!;
            if (s >= 4 || h >= 4) return `Has 4-card major (${s}S, ${h}H)`;
            return `No 4-card major (${s}S, ${h}H)`;
          },
        },
      ],
      call: () => bid(2, BidSuit.Clubs),
    }),

    // Pass after partner's 1NT: 0-7 HCP
    conditionedRule({
      name: "sayc-respond-1nt-pass",
      conditions: [
        isResponder(),
        partnerOpened(BidSuit.NoTrump),
        hcpRange(0, 7),
      ],
      call: () => pass,
    }),

    // ─── Responses to 1-level suit openings ────────────────────

    // Raise partner's major: 6-10 HCP, 3+ support
    conditionedRule({
      name: "sayc-respond-raise-major",
      conditions: [
        isResponder(),
        hcpRange(6, 10),
        // Partner opened a major and we have 3+ support
        {
          name: "major-support-3",
          inference: { type: "suit-min", params: { suitIndex: -1, suitName: "major", min: 3 } },
          test(ctx) {
            const strain = partnerOpeningStrain(ctx);
            if (strain === BidSuit.Hearts) return ctx.evaluation.shape[1]! >= 3;
            if (strain === BidSuit.Spades) return ctx.evaluation.shape[0]! >= 3;
            return false;
          },
          describe(ctx) {
            const strain = partnerOpeningStrain(ctx);
            if (strain === BidSuit.Hearts) {
              const len = ctx.evaluation.shape[1]!;
              return len >= 3 ? `${len} hearts (3+ support)` : `Only ${len} hearts`;
            }
            if (strain === BidSuit.Spades) {
              const len = ctx.evaluation.shape[0]!;
              return len >= 3 ? `${len} spades (3+ support)` : `Only ${len} spades`;
            }
            return "Partner did not open a major";
          },
        },
      ],
      call(ctx) {
        const strain = partnerOpeningStrain(ctx)!;
        return bid(2, strain);
      },
    }),

    // Jump raise partner's major: 10-12 HCP, 4+ support
    conditionedRule({
      name: "sayc-respond-jump-raise-major",
      conditions: [
        isResponder(),
        hcpRange(10, 12),
        {
          name: "major-support-4",
          inference: { type: "suit-min", params: { suitIndex: -1, suitName: "major", min: 4 } },
          test(ctx) {
            const strain = partnerOpeningStrain(ctx);
            if (strain === BidSuit.Hearts) return ctx.evaluation.shape[1]! >= 4;
            if (strain === BidSuit.Spades) return ctx.evaluation.shape[0]! >= 4;
            return false;
          },
          describe(ctx) {
            const strain = partnerOpeningStrain(ctx);
            if (strain === BidSuit.Hearts) {
              const len = ctx.evaluation.shape[1]!;
              return len >= 4 ? `${len} hearts (4+ support)` : `Only ${len} hearts`;
            }
            if (strain === BidSuit.Spades) {
              const len = ctx.evaluation.shape[0]!;
              return len >= 4 ? `${len} spades (4+ support)` : `Only ${len} spades`;
            }
            return "Partner did not open a major";
          },
        },
      ],
      call(ctx) {
        const strain = partnerOpeningStrain(ctx)!;
        return bid(3, strain);
      },
    }),

    // 1H over 1C/1D: 6+ HCP, 4+ hearts
    conditionedRule({
      name: "sayc-respond-1h-over-minor",
      conditions: [
        isResponder(),
        hcpMin(6),
        suitMin(1, "hearts", 4),
        {
          name: "partner-opened-minor",
          test(ctx) {
            const strain = partnerOpeningStrain(ctx);
            return strain === BidSuit.Clubs || strain === BidSuit.Diamonds;
          },
          describe(ctx) {
            const strain = partnerOpeningStrain(ctx);
            if (strain === BidSuit.Clubs || strain === BidSuit.Diamonds)
              return `Partner opened ${strain}`;
            return "Partner did not open a minor";
          },
        },
      ],
      call: () => bid(1, BidSuit.Hearts),
    }),

    // 1S over 1C/1D: 6+ HCP, 4+ spades
    conditionedRule({
      name: "sayc-respond-1s-over-minor",
      conditions: [
        isResponder(),
        hcpMin(6),
        suitMin(0, "spades", 4),
        {
          name: "partner-opened-minor",
          test(ctx) {
            const strain = partnerOpeningStrain(ctx);
            return strain === BidSuit.Clubs || strain === BidSuit.Diamonds;
          },
          describe(ctx) {
            const strain = partnerOpeningStrain(ctx);
            if (strain === BidSuit.Clubs || strain === BidSuit.Diamonds)
              return `Partner opened ${strain}`;
            return "Partner did not open a minor";
          },
        },
      ],
      call: () => bid(1, BidSuit.Spades),
    }),

    // 1S over 1H: 6+ HCP, 4+ spades
    conditionedRule({
      name: "sayc-respond-1s-over-1h",
      conditions: [
        isResponder(),
        partnerOpened(BidSuit.Hearts),
        hcpMin(6),
        suitMin(0, "spades", 4),
      ],
      call: () => bid(1, BidSuit.Spades),
    }),

    // 1NT response: partner opened suit, 6-10 HCP (no better bid)
    conditionedRule({
      name: "sayc-respond-1nt",
      conditions: [
        isResponder(),
        hcpRange(6, 10),
        not(partnerOpened(BidSuit.NoTrump)),
      ],
      call: () => bid(1, BidSuit.NoTrump),
    }),

    // 2NT response: 13-15 HCP, balanced, partner opened suit
    conditionedRule({
      name: "sayc-respond-2nt",
      conditions: [
        isResponder(),
        hcpRange(13, 15),
        isBalanced(),
        not(partnerOpened(BidSuit.NoTrump)),
      ],
      call: () => bid(2, BidSuit.NoTrump),
    }),

    // 3NT response: 16-18 HCP, balanced, partner opened suit
    conditionedRule({
      name: "sayc-respond-3nt",
      conditions: [
        isResponder(),
        hcpRange(16, 18),
        isBalanced(),
        not(partnerOpened(BidSuit.NoTrump)),
      ],
      call: () => bid(3, BidSuit.NoTrump),
    }),

    // ─── Competitive ───────────────────────────────────────────

    // Overcall at 1-level: opponent opened, 8-16 HCP, 5+ in a suit
    conditionedRule({
      name: "sayc-overcall-1level",
      conditions: [
        opponentBid(),
        hcpRange(8, 16),
        {
          name: "good-5-card-suit-at-1",
          test(ctx) {
            const lb = lastBid(ctx);
            if (!lb) return false;
            const strains: [number, BidSuit][] = [
              [0, BidSuit.Spades],
              [1, BidSuit.Hearts],
              [2, BidSuit.Diamonds],
              [3, BidSuit.Clubs],
            ];
            for (const [idx, strain] of strains) {
              if (ctx.evaluation.shape[idx]! >= 5) {
                if (bidIsHigher(1, strain, lb)) {
                  return true;
                }
              }
            }
            return false;
          },
          describe() {
            return "5+ card suit available at 1-level";
          },
        },
      ],
      call(ctx) {
        const lb = lastBid(ctx)!;
        const strains: [number, BidSuit][] = [
          [0, BidSuit.Spades],
          [1, BidSuit.Hearts],
          [2, BidSuit.Diamonds],
          [3, BidSuit.Clubs],
        ];
        let bestStrain = BidSuit.Spades;
        let bestLen = 0;
        for (const [idx, strain] of strains) {
          const len = ctx.evaluation.shape[idx]!;
          if (len >= 5 && bidIsHigher(1, strain, lb) && len > bestLen) {
            bestLen = len;
            bestStrain = strain;
          }
        }
        return bid(1, bestStrain);
      },
    }),

    // Overcall at 2-level: opponent opened, 10-16 HCP, 5+ in a suit
    conditionedRule({
      name: "sayc-overcall-2level",
      conditions: [
        opponentBid(),
        hcpRange(10, 16),
        {
          name: "good-5-card-suit-at-2",
          test(ctx) {
            const lb = lastBid(ctx);
            if (!lb) return false;
            // Need a 5+ card suit that can legally be bid at 2-level
            const suitStrains: BidSuit[] = [
              BidSuit.Spades,
              BidSuit.Hearts,
              BidSuit.Diamonds,
              BidSuit.Clubs,
            ];
            for (let i = 0; i < 4; i++) {
              if (
                ctx.evaluation.shape[i]! >= 5 &&
                bidIsHigher(2, suitStrains[i]!, lb)
              ) {
                return true;
              }
            }
            return false;
          },
          describe(ctx) {
            const longest = Math.max(...ctx.evaluation.shape);
            return longest >= 5
              ? `Has ${longest}-card suit for 2-level overcall`
              : `No 5+ card suit`;
          },
        },
      ],
      call(ctx) {
        const lb = lastBid(ctx)!;
        const suitStrains: BidSuit[] = [
          BidSuit.Spades,
          BidSuit.Hearts,
          BidSuit.Diamonds,
          BidSuit.Clubs,
        ];
        let bestIdx = -1;
        let bestLen = 0;
        for (let i = 0; i < 4; i++) {
          const len = ctx.evaluation.shape[i]!;
          if (
            len >= 5 &&
            bidIsHigher(2, suitStrains[i]!, lb) &&
            len > bestLen
          ) {
            bestLen = len;
            bestIdx = i;
          }
        }
        // Fallback: if no legal 2-level bid found, pass will catch it
        if (bestIdx === -1) return pass;
        return bid(2, suitStrains[bestIdx]!);
      },
    }),

    // ─── Default: Pass (catch-all) ─────────────────────────────

    conditionedRule({
      name: "sayc-pass",
      conditions: [],
      call: () => pass,
    }),
  ],
  examples: [], // No examples needed for internal convention
};
