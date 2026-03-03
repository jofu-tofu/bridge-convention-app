import type { BiddingContext } from "../types";
import type { ContractBid } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import { partnerSeat } from "../../../engine/constants";

// ─── Data-returning query helpers (not condition factories) ────

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
export const STRAIN_ORDER: Record<string, number> = {
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
