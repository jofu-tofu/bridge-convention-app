import type { BiddingContext, AuctionCondition } from "../types";
import type { ContractBid } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import { partnerSeat } from "../../../engine/constants";
import { auctionMatchesExact } from "../../../engine/auction-helpers";

// ─── Leaf auction condition factories ────────────────────────

/** Match auction entries exactly against a pattern. */
export function auctionMatches(pattern: string[]): AuctionCondition {
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
export function auctionMatchesAny(patterns: string[][]): AuctionCondition {
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
export function isOpener(): AuctionCondition {
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
export function isResponder(): AuctionCondition {
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
export function partnerOpened(strain?: BidSuit): AuctionCondition {
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
export function partnerOpenedAt(level: number, strain: BidSuit): AuctionCondition {
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
export function opponentBid(): AuctionCondition {
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
export function noPriorBid(): AuctionCondition {
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
export function biddingRound(n: number): AuctionCondition {
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
export function partnerBidAt(level: number, strain: BidSuit): AuctionCondition {
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
export function seatHasBid(): AuctionCondition {
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
export function advanceAfterDouble(): AuctionCondition {
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

// ─── Seat-agnostic milestone conditions ─────────────────────

/** Any player bid at this level/strain in the context. */
export function bidMade(level: number, strain: BidSuit): AuctionCondition {
  return {
    name: `bid-made-${level}${strain}`,
    label: `${level}${strain} was bid`,
    category: "auction",
    test(ctx) {
      return ctx.auction.entries.some(
        (e) =>
          e.call.type === "bid" &&
          e.call.level === level &&
          e.call.strain === strain,
      );
    },
    describe(ctx) {
      const found = ctx.auction.entries.some(
        (e) =>
          e.call.type === "bid" &&
          e.call.level === level &&
          e.call.strain === strain,
      );
      return found
        ? `${level}${strain} was bid`
        : `${level}${strain} was not bid`;
    },
  };
}

/** Any player doubled in the context. */
export function doubleMade(): AuctionCondition {
  return {
    name: "double-made",
    label: "A double was made",
    category: "auction",
    test(ctx) {
      return ctx.auction.entries.some((e) => e.call.type === "double");
    },
    describe(ctx) {
      return ctx.auction.entries.some((e) => e.call.type === "double")
        ? "A double was made"
        : "No double was made";
    },
  };
}

/** Any player bid at this level (any strain) in the context. */
export function bidMadeAtLevel(level: number): AuctionCondition {
  return {
    name: `bid-made-at-level-${level}`,
    label: `A ${level}-level bid was made`,
    category: "auction",
    test(ctx) {
      return ctx.auction.entries.some(
        (e) => e.call.type === "bid" && e.call.level === level,
      );
    },
    describe(ctx) {
      const found = ctx.auction.entries.find(
        (e) => e.call.type === "bid" && e.call.level === level,
      );
      return found
        ? `A ${level}-level bid was made`
        : `No ${level}-level bid was made`;
    },
  };
}

// ─── Seat-specific conditions for seatFilters ───────────────

/** An opponent made the first bid at this level and strain. */
export function opponentOpenedAt(level: number, strain: BidSuit): AuctionCondition {
  return {
    name: `opponent-opened-${level}${strain}`,
    label: `Opponent opened ${level}${strain}`,
    category: "auction",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          return (
            entry.seat !== ctx.seat &&
            entry.seat !== partner &&
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
          if (entry.seat !== ctx.seat && entry.seat !== partner &&
              entry.call.level === level && entry.call.strain === strain) {
            return `Opponent opened ${level}${strain}`;
          }
          return `Opponent did not open ${level}${strain}`;
        }
      }
      return "No bids yet";
    },
  };
}

/** This seat has made any action (pass, bid, double, redouble). */
export function seatHasActed(): AuctionCondition {
  return {
    name: "seat-has-acted",
    label: "Has previously acted",
    category: "auction",
    test(ctx) {
      return ctx.auction.entries.some((e) => e.seat === ctx.seat);
    },
    describe(ctx) {
      return ctx.auction.entries.some((e) => e.seat === ctx.seat)
        ? "This seat has previously acted"
        : "This seat has not acted yet";
    },
  };
}

/** This seat previously made a double. */
export function seatDoubled(): AuctionCondition {
  return {
    name: "seat-doubled",
    label: "Has previously doubled",
    category: "auction",
    test(ctx) {
      return ctx.auction.entries.some(
        (e) => e.call.type === "double" && e.seat === ctx.seat,
      );
    },
    describe(ctx) {
      return ctx.auction.entries.some(
        (e) => e.call.type === "double" && e.seat === ctx.seat,
      )
        ? "This seat previously doubled"
        : "This seat has not doubled";
    },
  };
}

/** This seat previously bid at this level/strain. */
export function seatBidAt(level: number, strain: BidSuit): AuctionCondition {
  return {
    name: `seat-bid-${level}${strain}`,
    label: `Has bid ${level}${strain}`,
    category: "auction",
    test(ctx) {
      return ctx.auction.entries.some(
        (e) =>
          e.seat === ctx.seat &&
          e.call.type === "bid" &&
          e.call.level === level &&
          e.call.strain === strain,
      );
    },
    describe(ctx) {
      return ctx.auction.entries.some(
        (e) =>
          e.seat === ctx.seat &&
          e.call.type === "bid" &&
          e.call.level === level &&
          e.call.strain === strain,
      )
        ? `This seat bid ${level}${strain}`
        : `This seat has not bid ${level}${strain}`;
    },
  };
}

/** Partner's most recent bid was at this level (any strain). */
export function partnerLastBidAtLevel(level: number): AuctionCondition {
  return {
    name: `partner-last-bid-level-${level}`,
    label: `Partner's last bid was at level ${level}`,
    category: "auction",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (let i = ctx.auction.entries.length - 1; i >= 0; i--) {
        const entry = ctx.auction.entries[i]!;
        if (entry.seat === partner && entry.call.type === "bid") {
          return entry.call.level === level;
        }
      }
      return false;
    },
    describe(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (let i = ctx.auction.entries.length - 1; i >= 0; i--) {
        const entry = ctx.auction.entries[i]!;
        if (entry.seat === partner && entry.call.type === "bid") {
          return entry.call.level === level
            ? `Partner's last bid was at level ${level}`
            : `Partner's last bid was at level ${entry.call.level}`;
        }
      }
      return "Partner has not bid";
    },
  };
}

/** Partner's most recent action was a double. */
export function partnerDoubled(): AuctionCondition {
  return {
    name: "partner-doubled",
    label: "Partner doubled",
    category: "auction",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (let i = ctx.auction.entries.length - 1; i >= 0; i--) {
        const entry = ctx.auction.entries[i]!;
        if (entry.seat === partner) {
          return entry.call.type === "double";
        }
      }
      return false;
    },
    describe(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (let i = ctx.auction.entries.length - 1; i >= 0; i--) {
        const entry = ctx.auction.entries[i]!;
        if (entry.seat === partner) {
          return entry.call.type === "double"
            ? "Partner doubled"
            : "Partner did not double";
        }
      }
      return "Partner has not acted";
    },
  };
}

/** Check that the entry immediately after a specific bid is a pass.
 *  Used in seatFilters to block convention when opponent interferes.
 *  Returns true if the bid was found and next entry is pass (or bid is last entry). */
export function passedAfter(level: number, strain: BidSuit): AuctionCondition {
  return {
    name: `passed-after-${level}${strain}`,
    label: `Pass followed ${level}${strain}`,
    category: "auction",
    test(ctx) {
      for (let i = 0; i < ctx.auction.entries.length; i++) {
        const entry = ctx.auction.entries[i]!;
        if (entry.call.type === "bid" && entry.call.level === level && entry.call.strain === strain) {
          const next = ctx.auction.entries[i + 1];
          // No next entry yet = no interference (auction still in progress)
          if (!next) return true;
          return next.call.type === "pass";
        }
      }
      return false;
    },
    describe(ctx) {
      for (let i = 0; i < ctx.auction.entries.length; i++) {
        const entry = ctx.auction.entries[i]!;
        if (entry.call.type === "bid" && entry.call.level === level && entry.call.strain === strain) {
          const next = ctx.auction.entries[i + 1];
          if (!next) return `${level}${strain} was bid, awaiting response`;
          return next.call.type === "pass"
            ? `Pass followed ${level}${strain}`
            : `Opponent acted after ${level}${strain}`;
        }
      }
      return `${level}${strain} was not bid`;
    },
  };
}

/** Check that the entry immediately after a double is a pass. */
export function passedAfterDouble(): AuctionCondition {
  return {
    name: "passed-after-double",
    label: "Pass followed double",
    category: "auction",
    test(ctx) {
      for (let i = 0; i < ctx.auction.entries.length; i++) {
        const entry = ctx.auction.entries[i]!;
        if (entry.call.type === "double") {
          const next = ctx.auction.entries[i + 1];
          if (!next) return true;
          return next.call.type === "pass";
        }
      }
      return false;
    },
    describe(ctx) {
      for (let i = 0; i < ctx.auction.entries.length; i++) {
        if (ctx.auction.entries[i]!.call.type === "double") {
          const next = ctx.auction.entries[i + 1];
          if (!next) return "Double was made, awaiting response";
          return next.call.type === "pass"
            ? "Pass followed double"
            : "Opponent acted after double";
        }
      }
      return "No double was made";
    },
  };
}

/** An opponent has made a non-pass action (bid, double, redouble). */
export function opponentActed(): AuctionCondition {
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

/** This seat has NOT previously passed in the auction. */
export function notPassedHand(): AuctionCondition {
  return {
    name: "not-passed-hand",
    label: "Has not previously passed",
    category: "auction",
    test(ctx) {
      // Check if this seat passed before making any contract bid
      for (const entry of ctx.auction.entries) {
        if (entry.seat === ctx.seat) {
          if (entry.call.type === "pass") return false;
          if (entry.call.type === "bid") return true;
        }
      }
      // Seat hasn't acted yet — not a passed hand
      return true;
    },
    describe(ctx) {
      for (const entry of ctx.auction.entries) {
        if (entry.seat === ctx.seat) {
          if (entry.call.type === "pass") return "This seat previously passed — passed hand";
          if (entry.call.type === "bid") return "This seat has not passed — not a passed hand";
        }
      }
      return "Has not acted yet — not a passed hand";
    },
  };
}

/** Partner's first bid strain is Hearts or Spades. Pure auction check. */
export function partnerOpenedMajor(): AuctionCondition {
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
export function partnerOpenedMinor(): AuctionCondition {
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

/** The most recent auction entry is a pass. Used in seatFilters to verify
 *  no interference occurred before this seat's turn. Returns true if the
 *  auction is empty (no entries yet). */
export function lastEntryIsPass(): AuctionCondition {
  return {
    name: "last-entry-is-pass",
    label: "Last action was a pass",
    category: "auction",
    test(ctx) {
      const entries = ctx.auction.entries;
      if (entries.length === 0) return true;
      return entries[entries.length - 1]!.call.type === "pass";
    },
    describe(ctx) {
      const entries = ctx.auction.entries;
      if (entries.length === 0) return "No auction entries yet";
      const last = entries[entries.length - 1]!;
      return last.call.type === "pass"
        ? "Last action was a pass"
        : `Last action was ${last.call.type} (not a pass)`;
    },
  };
}
