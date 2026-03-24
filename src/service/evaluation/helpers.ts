// ── Shared evaluation helpers ───────────────────────────────────────
//
// Common functions used by both atom-evaluator and playthrough-evaluator.
// Uses engine/constants for seat operations instead of local redefinitions.

import { nextSeat, partnerSeat } from "../../engine/constants";
import { createBiddingContext } from "../../conventions";
import { evaluateHand } from "../../engine/hand-evaluator";
import { callsMatch } from "../../engine/call-helpers";
import { getLegalCalls } from "../../engine/auction";
import { generateDeal } from "../../engine/deal-generator";
import { mulberry32 } from "../../core/util/seeded-rng";
import { buildBiddingViewport } from "../build-viewport";
import { Seat } from "../../engine/types";
import type { Auction, Deal, Hand, DealConstraints , Vulnerability } from "../../engine/types";
import type { BiddingStrategy, BidHistoryEntry } from "../../core/contracts/bidding";
import type { ConventionBundle } from "../../conventions";
import type { BiddingViewport } from "../response-types";

export { nextSeat, partnerSeat };

export function generateSeededDeal(
  bundle: ConventionBundle,
  seed: number,
  vulnerability?: Vulnerability,
): Deal {
  const rng = mulberry32(seed);
  const constraints: DealConstraints = {
    ...bundle.dealConstraints,
    ...(vulnerability !== undefined ? { vulnerability } : {}),
  };
  return generateDeal(constraints, rng).deal;
}

export function resolveUserSeat(bundle: ConventionBundle, deal: Deal): Seat {
  for (const seat of [Seat.South, Seat.East, Seat.North, Seat.West]) {
    if (bundle.defaultAuction) {
      const auction = bundle.defaultAuction(seat, deal);
      if (auction && auction.entries.length > 0) return seat;
    }
  }
  return Seat.South;
}

export function buildInitialAuction(bundle: ConventionBundle, userSeat: Seat, deal: Deal): Auction {
  if (bundle.defaultAuction) {
    const auction = bundle.defaultAuction(userSeat, deal);
    if (auction) return auction;
  }
  return { entries: [], isComplete: false };
}

export function buildContext(hand: Hand, auction: Auction, seat: Seat, vulnerability: Vulnerability) {
  return createBiddingContext({
    hand,
    auction,
    seat,
    evaluation: evaluateHand(hand),
    vulnerability,
    dealer: auction.entries.length > 0 ? auction.entries[0]!.seat : Seat.North,
  });
}

export function buildBidHistory(
  auction: Auction, deal: Deal, userSeat: Seat,
  strategy: BiddingStrategy, vulnerability: Vulnerability,
): BidHistoryEntry[] {
  const partner = partnerSeat(userSeat);
  const history: BidHistoryEntry[] = [];
  for (let i = 0; i < auction.entries.length; i++) {
    const entry = auction.entries[i]!;
    if (entry.seat !== userSeat && entry.seat !== partner) {
      history.push({ seat: entry.seat, call: entry.call, isUser: false });
      continue;
    }
    const auctionBefore: Auction = { entries: auction.entries.slice(0, i), isComplete: false };
    const ctx = buildContext(deal.hands[entry.seat], auctionBefore, entry.seat, vulnerability);
    const result = strategy.suggest(ctx);
    const bidMatches = result && callsMatch(result.call, entry.call);
    history.push({
      seat: entry.seat, call: entry.call,
      meaning: bidMatches ? result?.meaning : undefined, isUser: entry.seat === userSeat,
      alertLabel: bidMatches ? result?.alert?.teachingLabel : undefined,
      annotationType: bidMatches ? result?.alert?.annotationType : undefined,
    });
  }
  return history;
}

export function makeViewport(
  deal: Deal, auction: Auction, userSeat: Seat, activeSeat: Seat,
  strategy: BiddingStrategy, bundleName: string, vulnerability: Vulnerability,
): BiddingViewport {
  const bidHistory = buildBidHistory(auction, deal, userSeat, strategy, vulnerability);
  return buildBiddingViewport({
    deal, userSeat: activeSeat, auction, bidHistory,
    legalCalls: getLegalCalls(auction, activeSeat),
    faceUpSeats: new Set([activeSeat]),
    conventionName: bundleName,
    isUserTurn: true,
    currentBidder: activeSeat,
  });
}
