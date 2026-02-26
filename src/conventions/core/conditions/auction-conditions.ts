import type { BiddingContext, RuleCondition } from "../types";
import type { ContractBid } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import { partnerSeat } from "../../../engine/constants";
import { auctionMatchesExact } from "../../../engine/auction-helpers";

// ─── Leaf auction condition factories ────────────────────────

/** Match auction entries exactly against a pattern. */
export function auctionMatches(pattern: string[]): RuleCondition {
  const patternLabel = pattern.join(" — ");
  return {
    name: "auction",
    label: `After ${patternLabel}`,
    category: "auction",
    test(ctx) {
      return auctionMatchesExact(ctx.auction, pattern);
    },
    describe(ctx) {
      return auctionMatchesExact(ctx.auction, pattern)
        ? `After ${patternLabel}`
        : `Auction does not match ${patternLabel}`;
    },
  };
}

/** Match auction against any of several patterns. */
export function auctionMatchesAny(patterns: string[][]): RuleCondition {
  const labels = patterns.map((p) => p.join(" — ")).join(" or ");
  return {
    name: "auction",
    label: `After ${labels}`,
    category: "auction",
    test(ctx) {
      return patterns.some((p) => auctionMatchesExact(ctx.auction, p));
    },
    describe(ctx) {
      const matched = patterns.find((p) => auctionMatchesExact(ctx.auction, p));
      if (matched) return `After ${matched.join(" — ")}`;
      return `Auction does not match ${labels}`;
    },
  };
}

// ─── Relational condition factories ──────────────────────────

/** Check if this seat made the first non-pass bid in the auction. */
export function isOpener(): RuleCondition {
  return {
    name: "is-opener",
    label: "Opening bidder",
    category: "auction",
    test(ctx) {
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          return entry.seat === ctx.seat;
        }
      }
      // No bids yet — we could be the opener
      return true;
    },
    describe(ctx) {
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          return entry.seat === ctx.seat
            ? "This seat opened the bidding"
            : "This seat did not open the bidding";
        }
      }
      return "No bids yet — opening position";
    },
  };
}

/** Check if partner made the first non-pass bid (this seat is responding). */
export function isResponder(): RuleCondition {
  return {
    name: "is-responder",
    label: "Responding to partner's opening",
    category: "auction",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          return entry.seat === partner;
        }
      }
      return false;
    },
    describe(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          return entry.seat === partner
            ? "Partner opened — responding position"
            : "Partner did not open";
        }
      }
      return "No bids yet — not in responding position";
    },
  };
}

/** Check if partner opened in a specific strain, or any strain if not specified. */
export function partnerOpened(strain?: BidSuit): RuleCondition {
  const condName = strain ? `partner opened ${strain}` : "partner opened";
  return {
    name: condName,
    label: strain ? `Partner opened ${strain}` : "Partner opened",
    category: "auction",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          if (entry.seat !== partner) return false;
          if (strain) return entry.call.strain === strain;
          return true;
        }
      }
      return false;
    },
    describe(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          if (entry.seat !== partner)
            return `Partner did not open (${entry.seat} opened)`;
          if (strain && entry.call.strain !== strain) {
            return `Partner opened ${entry.call.strain}, not ${strain}`;
          }
          return `Partner opened ${entry.call.strain}`;
        }
      }
      return "No opening bid found";
    },
  };
}

/** Check if partner opened at a specific level and strain. */
export function partnerOpenedAt(level: number, strain: BidSuit): RuleCondition {
  return {
    name: `partner-opened-${level}${strain}`,
    label: `Partner opened ${level}${strain}`,
    category: "auction",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          return (
            entry.seat === partner &&
            entry.call.level === level &&
            entry.call.strain === strain
          );
        }
      }
      return false;
    },
    describe(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          if (entry.seat !== partner) return `Partner did not open`;
          if (entry.call.level !== level || entry.call.strain !== strain) {
            return `Partner opened ${entry.call.level}${entry.call.strain}, not ${level}${strain}`;
          }
          return `Partner opened ${level}${strain}`;
        }
      }
      return "No opening bid found";
    },
  };
}



/** Check if an opponent has made a contract bid. */
export function opponentBid(): RuleCondition {
  return {
    name: "opponent-bid",
    label: "Opponent has bid",
    category: "auction",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      return ctx.auction.entries.some(
        (e) =>
          e.call.type === "bid" &&
          e.seat !== ctx.seat &&
          e.seat !== partner,
      );
    },
    describe(ctx) {
      const partner = partnerSeat(ctx.seat);
      const found = ctx.auction.entries.find(
        (e) =>
          e.call.type === "bid" &&
          e.seat !== ctx.seat &&
          e.seat !== partner,
      );
      return found ? `Opponent (${found.seat}) bid` : "No opponent bids";
    },
  };
}

/** No previous contract bid in the auction (everyone passed so far). */
export function noPriorBid(): RuleCondition {
  return {
    name: "no-prior-bid",
    label: "No prior contract bids",
    category: "auction",
    test(ctx) {
      return ctx.auction.entries.every((e) => e.call.type !== "bid");
    },
    describe(ctx) {
      const hasBid = ctx.auction.entries.some((e) => e.call.type === "bid");
      return hasBid ? "Prior contract bid exists" : "No prior contract bids";
    },
  };
}

/** This seat is making their Nth contract bid (0-indexed). Round 0 = first bid, Round 1 = rebid. */
export function biddingRound(n: number): RuleCondition {
  return {
    name: "bidding-round",
    label: `Bidding round ${n}`,
    category: "auction",
    test(ctx) {
      let count = 0;
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid" && entry.seat === ctx.seat) {
          count++;
        }
      }
      return count === n;
    },
    describe(ctx) {
      let count = 0;
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid" && entry.seat === ctx.seat) {
          count++;
        }
      }
      return count === n
        ? `Seat has made ${n} prior bid${n !== 1 ? "s" : ""} (round ${n})`
        : `Seat has made ${count} prior bid${count !== 1 ? "s" : ""} (need round ${n})`;
    },
  };
}

/** Partner bid at a specific level and strain at any point in the auction. */
export function partnerBidAt(level: number, strain: BidSuit): RuleCondition {
  return {
    name: `partner-bid-${level}${strain}`,
    label: `Partner bid ${level}${strain}`,
    category: "auction",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      return ctx.auction.entries.some(
        (e) =>
          e.seat === partner &&
          e.call.type === "bid" &&
          e.call.level === level &&
          e.call.strain === strain,
      );
    },
    describe(ctx) {
      const partner = partnerSeat(ctx.seat);
      const found = ctx.auction.entries.some(
        (e) =>
          e.seat === partner &&
          e.call.type === "bid" &&
          e.call.level === level &&
          e.call.strain === strain,
      );
      return found
        ? `Partner bid ${level}${strain}`
        : `Partner has not bid ${level}${strain}`;
    },
  };
}

/** This seat has made at least one contract bid in the auction. */
export function seatHasBid(): RuleCondition {
  return {
    name: "seat-has-bid",
    label: "Has previously bid",
    category: "auction",
    test(ctx) {
      return ctx.auction.entries.some(
        (e) => e.call.type === "bid" && e.seat === ctx.seat,
      );
    },
    describe(ctx) {
      const hasBid = ctx.auction.entries.some(
        (e) => e.call.type === "bid" && e.seat === ctx.seat,
      );
      return hasBid
        ? "This seat has previously bid"
        : "This seat has not bid yet";
    },
  };
}

/** DONT advance after double: always relay 2C. */
export function advanceAfterDouble(): RuleCondition {
  return {
    name: "advance-after-double",
    label: "After partner's double, relay 2C",
    category: "auction",
    test(ctx) {
      return auctionMatchesExact(ctx.auction, ["1NT", "X", "P"]);
    },
    describe(ctx) {
      return auctionMatchesExact(ctx.auction, ["1NT", "X", "P"])
        ? "After partner's double, relay 2C to discover suit"
        : "Not after partner's double";
    },
  };
}

// ─── SAYC-extracted helpers (data-returning, not condition factories) ────

/** Find the strain of the first contract bid by partner. */
export function partnerOpeningStrain(ctx: BiddingContext): BidSuit | null {
  const partner = partnerSeat(ctx.seat);
  for (const entry of ctx.auction.entries) {
    if (entry.call.type === "bid" && entry.seat === partner) {
      return entry.call.strain;
    }
  }
  return null;
}

/** Get this seat's first contract bid strain. */
export function seatFirstBidStrain(ctx: BiddingContext): BidSuit | null {
  for (const entry of ctx.auction.entries) {
    if (entry.call.type === "bid" && entry.seat === ctx.seat) {
      return entry.call.strain;
    }
  }
  return null;
}

/** Check if partner responded with a major (not the strain we opened). */
export function partnerRespondedMajor(ctx: BiddingContext): BidSuit | null {
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

/** Find the last contract bid in the auction by any player. */
export function lastBid(ctx: BiddingContext): ContractBid | null {
  for (let i = ctx.auction.entries.length - 1; i >= 0; i--) {
    const call = ctx.auction.entries[i]!.call;
    if (call.type === "bid") return call;
  }
  return null;
}

/** Canonical denomination ordering for bid legality checks. */
const STRAIN_ORDER: Record<string, number> = {
  [BidSuit.Clubs]: 0,
  [BidSuit.Diamonds]: 1,
  [BidSuit.Hearts]: 2,
  [BidSuit.Spades]: 3,
  [BidSuit.NoTrump]: 4,
};

/** Check if a bid at (level, strain) is higher than an existing bid. */
export function bidIsHigher(
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

/** An opponent has made a non-pass action (bid, double, redouble). */
export function opponentActed(): RuleCondition {
  return {
    name: "opponent-acted",
    label: "Opponent acted (bid/double/redouble)",
    category: "auction",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      return ctx.auction.entries.some(
        (e) =>
          e.call.type !== "pass" &&
          e.seat !== ctx.seat &&
          e.seat !== partner,
      );
    },
    describe(ctx) {
      const partner = partnerSeat(ctx.seat);
      const found = ctx.auction.entries.find(
        (e) =>
          e.call.type !== "pass" &&
          e.seat !== ctx.seat &&
          e.seat !== partner,
      );
      return found ? `Opponent (${found.seat}) acted` : "No opponent action";
    },
  };
}

/** Partner's first bid strain is Hearts or Spades. Pure auction check. */
export function partnerOpenedMajor(): RuleCondition {
  return {
    name: "partner-opened-major",
    label: "Partner opened a major suit",
    category: "auction",
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
  };
}

/** Partner's first bid strain is Clubs or Diamonds. Pure auction check. */
export function partnerOpenedMinor(): RuleCondition {
  return {
    name: "partner-opened-minor",
    label: "Partner opened a minor suit",
    category: "auction",
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
  };
}
