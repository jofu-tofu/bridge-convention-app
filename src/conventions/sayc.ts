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
  partnerOpenedAt,
  opponentBid,
  isBalanced,
  noFiveCardMajor,
  longerMajor,
  noPriorBid,
  seatHasBid,
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

/** Get this seat's first contract bid strain. */
function seatFirstBidStrain(ctx: BiddingContext): BidSuit | null {
  for (const entry of ctx.auction.entries) {
    if (entry.call.type === "bid" && entry.seat === ctx.seat) {
      return entry.call.strain;
    }
  }
  return null;
}

/** Check if partner's last bid is the same strain this seat opened. */
function partnerRaisedOurSuit(ctx: BiddingContext): boolean {
  const ourStrain = seatFirstBidStrain(ctx);
  if (!ourStrain) return false;
  const partner = partnerSeat(ctx.seat);
  for (let i = ctx.auction.entries.length - 1; i >= 0; i--) {
    const entry = ctx.auction.entries[i]!;
    if (entry.call.type === "bid" && entry.seat === partner) {
      return entry.call.strain === ourStrain;
    }
  }
  return false;
}

/** Check if partner responded with a major (not the strain we opened). */
function partnerRespondedMajor(ctx: BiddingContext): BidSuit | null {
  const partner = partnerSeat(ctx.seat);
  for (let i = ctx.auction.entries.length - 1; i >= 0; i--) {
    const entry = ctx.auction.entries[i]!;
    if (entry.call.type === "bid" && entry.seat === partner) {
      if (entry.call.strain === BidSuit.Hearts || entry.call.strain === BidSuit.Spades) {
        return entry.call.strain;
      }
      return null;
    }
  }
  return null;
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
      auctionConditions: [noPriorBid(), isOpener()],
      handConditions: [hcpMin(22)],
      call: () => bid(2, BidSuit.Clubs),
    }),

    // 2NT: 20-21 HCP, balanced (before 1NT to avoid 1-level suit catch-all)
    conditionedRule({
      name: "sayc-open-2nt",
      auctionConditions: [noPriorBid(), isOpener()],
      handConditions: [hcpRange(20, 21), isBalanced()],
      call: () => bid(2, BidSuit.NoTrump),
    }),

    // 1NT: 15-17 HCP, balanced, no 5-card major
    conditionedRule({
      name: "sayc-open-1nt",
      auctionConditions: [noPriorBid(), isOpener()],
      handConditions: [hcpRange(15, 17), isBalanced(), noFiveCardMajor()],
      call: () => bid(1, BidSuit.NoTrump),
    }),

    // 1S: 12+ HCP, 5+ spades (spades >= hearts)
    conditionedRule({
      name: "sayc-open-1s",
      auctionConditions: [noPriorBid(), isOpener()],
      handConditions: [hcpMin(12), longerMajor(0, "spades")],
      call: () => bid(1, BidSuit.Spades),
    }),

    // 1H: 12+ HCP, 5+ hearts
    conditionedRule({
      name: "sayc-open-1h",
      auctionConditions: [noPriorBid(), isOpener()],
      handConditions: [hcpMin(12), suitMin(1, "hearts", 5)],
      call: () => bid(1, BidSuit.Hearts),
    }),

    // 1D: 12+ HCP, 4+ diamonds (longer minor or equal)
    conditionedRule({
      name: "sayc-open-1d",
      auctionConditions: [noPriorBid(), isOpener()],
      handConditions: [
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
      auctionConditions: [noPriorBid(), isOpener()],
      handConditions: [
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
      auctionConditions: [noPriorBid(), isOpener()],
      handConditions: [hcpRange(5, 11), suitMin(1, "hearts", 6)],
      call: () => bid(2, BidSuit.Hearts),
    }),

    // Weak 2S: 5-11 HCP, 6+ spades
    conditionedRule({
      name: "sayc-open-weak-2s",
      auctionConditions: [noPriorBid(), isOpener()],
      handConditions: [hcpRange(5, 11), suitMin(0, "spades", 6)],
      call: () => bid(2, BidSuit.Spades),
    }),

    // Weak 2D: 5-11 HCP, 6+ diamonds
    conditionedRule({
      name: "sayc-open-weak-2d",
      auctionConditions: [noPriorBid(), isOpener()],
      handConditions: [hcpRange(5, 11), suitMin(2, "diamonds", 6)],
      call: () => bid(2, BidSuit.Diamonds),
    }),

    // ─── Responses to 1NT ──────────────────────────────────────

    // Stayman after partner's 1NT: 8+ HCP, 4-card major
    conditionedRule({
      name: "sayc-respond-1nt-stayman",
      auctionConditions: [isResponder(), partnerOpenedAt(1, BidSuit.NoTrump)],
      handConditions: [
        hcpMin(8),
        // Must have at least one 4-card major
        {
          name: "has-4-card-major",
          label: "Has 4+ card major",
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
      auctionConditions: [isResponder(), partnerOpenedAt(1, BidSuit.NoTrump)],
      handConditions: [hcpRange(0, 7)],
      call: () => pass,
    }),

    // ─── Responses to 1-level suit openings ────────────────────

    // Raise partner's major: 6-10 HCP, 3+ support
    conditionedRule({
      name: "sayc-respond-raise-major",
      auctionConditions: [isResponder()],
      handConditions: [
        hcpRange(6, 10),
        // Hybrid: checks auction to resolve suit, gates on hand support
        {
          name: "major-support-3",
          label: "3+ in partner's opened major",
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
      auctionConditions: [isResponder()],
      handConditions: [
        hcpRange(10, 12),
        // Hybrid: checks auction to resolve suit, gates on hand support
        {
          name: "major-support-4",
          label: "4+ in partner's opened major",
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

    // Game raise partner's major: 13+ HCP, 4+ support
    conditionedRule({
      name: "sayc-respond-game-raise-major",
      auctionConditions: [isResponder()],
      handConditions: [
        hcpMin(13),
        // Hybrid: checks auction to resolve suit, gates on hand support
        {
          name: "major-support-4-for-game",
          label: "4+ in partner's major (game)",
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
              return len >= 4 ? `${len} hearts (4+ for game)` : `Only ${len} hearts`;
            }
            if (strain === BidSuit.Spades) {
              const len = ctx.evaluation.shape[0]!;
              return len >= 4 ? `${len} spades (4+ for game)` : `Only ${len} spades`;
            }
            return "Partner did not open a major";
          },
        },
      ],
      call(ctx) {
        const strain = partnerOpeningStrain(ctx)!;
        return bid(4, strain);
      },
    }),

    // 1H over 1C/1D: 6+ HCP, 4+ hearts
    conditionedRule({
      name: "sayc-respond-1h-over-minor",
      auctionConditions: [isResponder()],
      handConditions: [
        hcpMin(6),
        suitMin(1, "hearts", 4),
        // Hybrid: checks auction to verify partner opened minor
        {
          name: "partner-opened-minor",
          label: "Partner opened a minor suit",
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
      auctionConditions: [isResponder()],
      handConditions: [
        hcpMin(6),
        suitMin(0, "spades", 4),
        // Hybrid: checks auction to verify partner opened minor
        {
          name: "partner-opened-minor",
          label: "Partner opened a minor suit",
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
      auctionConditions: [isResponder(), partnerOpened(BidSuit.Hearts)],
      handConditions: [hcpMin(6), suitMin(0, "spades", 4)],
      call: () => bid(1, BidSuit.Spades),
    }),

    // 2C over partner's major: 12+ HCP, 4+ clubs (2-over-1 game force)
    conditionedRule({
      name: "sayc-respond-2c-over-major",
      auctionConditions: [isResponder()],
      handConditions: [
        hcpMin(12),
        suitMin(3, "clubs", 4),
        // Hybrid: checks auction to verify partner opened major
        {
          name: "partner-opened-major",
          label: "Partner opened a major suit",
          test(ctx) {
            const strain = partnerOpeningStrain(ctx);
            return strain === BidSuit.Hearts || strain === BidSuit.Spades;
          },
          describe(ctx) {
            const strain = partnerOpeningStrain(ctx);
            if (strain === BidSuit.Hearts || strain === BidSuit.Spades)
              return `Partner opened ${strain}`;
            return "Partner did not open a major";
          },
        },
      ],
      call: () => bid(2, BidSuit.Clubs),
    }),

    // 2D over partner's major: 12+ HCP, 4+ diamonds (2-over-1 game force)
    conditionedRule({
      name: "sayc-respond-2d-over-major",
      auctionConditions: [isResponder()],
      handConditions: [
        hcpMin(12),
        suitMin(2, "diamonds", 4),
        // Hybrid: checks auction to verify partner opened major
        {
          name: "partner-opened-major",
          label: "Partner opened a major suit",
          test(ctx) {
            const strain = partnerOpeningStrain(ctx);
            return strain === BidSuit.Hearts || strain === BidSuit.Spades;
          },
          describe(ctx) {
            const strain = partnerOpeningStrain(ctx);
            if (strain === BidSuit.Hearts || strain === BidSuit.Spades)
              return `Partner opened ${strain}`;
            return "Partner did not open a major";
          },
        },
      ],
      call: () => bid(2, BidSuit.Diamonds),
    }),

    // 1NT response: partner opened suit, 6-10 HCP (no better bid)
    conditionedRule({
      name: "sayc-respond-1nt",
      auctionConditions: [isResponder(), not(partnerOpened(BidSuit.NoTrump))],
      handConditions: [hcpRange(6, 10)],
      call: () => bid(1, BidSuit.NoTrump),
    }),

    // 2NT response: 13-15 HCP, balanced, partner opened suit
    conditionedRule({
      name: "sayc-respond-2nt",
      auctionConditions: [isResponder(), not(partnerOpened(BidSuit.NoTrump))],
      handConditions: [hcpRange(13, 15), isBalanced()],
      call: () => bid(2, BidSuit.NoTrump),
    }),

    // 3NT response: 16-18 HCP, balanced, partner opened suit
    conditionedRule({
      name: "sayc-respond-3nt",
      auctionConditions: [isResponder(), not(partnerOpened(BidSuit.NoTrump))],
      handConditions: [hcpRange(16, 18), isBalanced()],
      call: () => bid(3, BidSuit.NoTrump),
    }),

    // ─── Competitive ───────────────────────────────────────────

    // 1NT overcall: opponent opened, 15-18 HCP, balanced
    conditionedRule({
      name: "sayc-1nt-overcall",
      auctionConditions: [opponentBid(), not(isOpener()), not(isResponder())],
      handConditions: [hcpRange(15, 18), isBalanced()],
      call: () => bid(1, BidSuit.NoTrump),
    }),

    // Overcall at 1-level: opponent opened, 8-16 HCP, 5+ in a suit
    conditionedRule({
      name: "sayc-overcall-1level",
      auctionConditions: [opponentBid()],
      handConditions: [
        hcpRange(8, 16),
        // Hybrid: checks auction for last bid to determine legal bids
        {
          name: "good-5-card-suit-at-1",
          label: "5+ card suit biddable at 1-level",
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
      auctionConditions: [opponentBid()],
      handConditions: [
        hcpRange(10, 16),
        // Hybrid: checks auction for last bid to determine legal bids
        {
          name: "good-5-card-suit-at-2",
          label: "5+ card suit biddable at 2-level",
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

    // ─── Opener Rebids ─────────────────────────────────────────

    // After partner raises our major: bid game with 19+
    conditionedRule({
      name: "sayc-rebid-4m-after-raise",
      auctionConditions: [isOpener(), seatHasBid()],
      handConditions: [
        hcpMin(19),
        // Hybrid: checks auction for partner's raise
        {
          name: "partner-raised-our-major",
          label: "Partner raised our major suit",
          test(ctx) {
            const ourStrain = seatFirstBidStrain(ctx);
            if (ourStrain !== BidSuit.Hearts && ourStrain !== BidSuit.Spades) return false;
            return partnerRaisedOurSuit(ctx);
          },
          describe(ctx) {
            const ourStrain = seatFirstBidStrain(ctx);
            if (ourStrain && partnerRaisedOurSuit(ctx))
              return `Partner raised our ${ourStrain}`;
            return "Partner did not raise our major";
          },
        },
      ],
      call(ctx) {
        return bid(4, seatFirstBidStrain(ctx)!);
      },
    }),

    // After partner raises our major: invite with 17-18
    conditionedRule({
      name: "sayc-rebid-3m-invite",
      auctionConditions: [isOpener(), seatHasBid()],
      handConditions: [
        hcpRange(17, 18),
        // Hybrid: checks auction for partner's raise
        {
          name: "partner-raised-our-major",
          label: "Partner raised our major suit",
          test(ctx) {
            const ourStrain = seatFirstBidStrain(ctx);
            if (ourStrain !== BidSuit.Hearts && ourStrain !== BidSuit.Spades) return false;
            return partnerRaisedOurSuit(ctx);
          },
          describe(ctx) {
            const ourStrain = seatFirstBidStrain(ctx);
            if (ourStrain && partnerRaisedOurSuit(ctx))
              return `Partner raised our ${ourStrain}`;
            return "Partner did not raise our major";
          },
        },
      ],
      call(ctx) {
        return bid(3, seatFirstBidStrain(ctx)!);
      },
    }),

    // After partner raises our major: pass with 12-16 (minimum)
    conditionedRule({
      name: "sayc-rebid-pass-after-raise",
      auctionConditions: [isOpener(), seatHasBid()],
      handConditions: [
        hcpRange(12, 16),
        // Hybrid: checks auction for partner's raise
        {
          name: "partner-raised-our-major",
          label: "Partner raised our major suit",
          test(ctx) {
            const ourStrain = seatFirstBidStrain(ctx);
            if (ourStrain !== BidSuit.Hearts && ourStrain !== BidSuit.Spades) return false;
            return partnerRaisedOurSuit(ctx);
          },
          describe(ctx) {
            const ourStrain = seatFirstBidStrain(ctx);
            if (ourStrain && partnerRaisedOurSuit(ctx))
              return `Partner raised our ${ourStrain}`;
            return "Partner did not raise our major";
          },
        },
      ],
      call: () => pass,
    }),

    // Raise partner's major response: 4+ support, 12-16
    conditionedRule({
      name: "sayc-rebid-raise-partner-major",
      auctionConditions: [isOpener(), seatHasBid()],
      handConditions: [
        hcpRange(12, 16),
        // Hybrid: checks auction for partner's major response
        {
          name: "partner-responded-major-with-support",
          label: "4+ support for partner's major response",
          test(ctx) {
            const partnerMajor = partnerRespondedMajor(ctx);
            if (!partnerMajor) return false;
            if (partnerMajor === BidSuit.Hearts) return ctx.evaluation.shape[1]! >= 4;
            return ctx.evaluation.shape[0]! >= 4;
          },
          describe(ctx) {
            const partnerMajor = partnerRespondedMajor(ctx);
            if (!partnerMajor) return "Partner did not respond with a major";
            const idx = partnerMajor === BidSuit.Hearts ? 1 : 0;
            const len = ctx.evaluation.shape[idx]!;
            return len >= 4
              ? `${len} ${partnerMajor} (4+ support for partner's response)`
              : `Only ${len} ${partnerMajor}`;
          },
        },
      ],
      call(ctx) {
        const partnerMajor = partnerRespondedMajor(ctx)!;
        return bid(2, partnerMajor);
      },
    }),

    // Rebid own suit with 6+ cards, 12-17
    conditionedRule({
      name: "sayc-rebid-own-suit",
      auctionConditions: [isOpener(), seatHasBid()],
      handConditions: [
        hcpRange(12, 17),
        // Hybrid: checks auction for our first bid suit
        {
          name: "6-plus-in-opened-suit",
          label: "6+ cards in opened suit",
          test(ctx) {
            const ourStrain = seatFirstBidStrain(ctx);
            if (!ourStrain) return false;
            const suitIdx = [BidSuit.Spades, BidSuit.Hearts, BidSuit.Diamonds, BidSuit.Clubs]
              .indexOf(ourStrain);
            return suitIdx >= 0 && ctx.evaluation.shape[suitIdx]! >= 6;
          },
          describe(ctx) {
            const ourStrain = seatFirstBidStrain(ctx);
            if (!ourStrain) return "No previous bid";
            const suitIdx = [BidSuit.Spades, BidSuit.Hearts, BidSuit.Diamonds, BidSuit.Clubs]
              .indexOf(ourStrain);
            if (suitIdx < 0) return "Not a suit bid";
            const len = ctx.evaluation.shape[suitIdx]!;
            return len >= 6
              ? `${len} ${ourStrain} (rebiddable)`
              : `Only ${len} ${ourStrain} (need 6+)`;
          },
        },
      ],
      call(ctx) {
        return bid(2, seatFirstBidStrain(ctx)!);
      },
    }),

    // Rebid 1NT: opened minor, 12-14 balanced
    conditionedRule({
      name: "sayc-rebid-1nt",
      auctionConditions: [isOpener(), seatHasBid()],
      handConditions: [hcpRange(12, 14), isBalanced()],
      call: () => bid(1, BidSuit.NoTrump),
    }),

    // Rebid 2NT: 18-19 balanced (too strong for 1NT opening, too weak for 2NT opening)
    conditionedRule({
      name: "sayc-rebid-2nt",
      auctionConditions: [isOpener(), seatHasBid()],
      handConditions: [hcpRange(18, 19), isBalanced()],
      call: () => bid(2, BidSuit.NoTrump),
    }),

    // ─── Default: Pass (catch-all) ─────────────────────────────

    conditionedRule({
      name: "sayc-pass",
      auctionConditions: [],
      handConditions: [],
      call: () => pass,
    }),
  ],
  examples: [], // No examples needed for internal convention
};
