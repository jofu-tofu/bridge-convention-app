import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import type { BiddingContext } from "../../core/types";
import { partnerOpeningStrain, seatFirstBidStrain } from "../../core/conditions";

const pass: Call = { type: "pass" };

/** Resolve a major strain, returning null if not Hearts or Spades. */
export function asMajor(strain: BidSuit | null): BidSuit.Hearts | BidSuit.Spades | null {
  if (strain === BidSuit.Hearts || strain === BidSuit.Spades) return strain;
  return null;
}

/** Dynamic call: return 4 of opener's major (game raise / game try accept). */
export function gameInOpenersMajor(ctx: BiddingContext): Call {
  const strain = asMajor(partnerOpeningStrain(ctx));
  if (!strain) return pass;
  return { type: "bid", level: 4, strain };
}

/** Dynamic call: return 3 of opener's major (preemptive raise / game try reject). */
export function threeOfOpenersMajor(ctx: BiddingContext): Call {
  const strain = asMajor(partnerOpeningStrain(ctx));
  if (!strain) return pass;
  return { type: "bid", level: 3, strain };
}

/** Alias: game try accept produces the same call as game raise (4M). */
export const gameTryAcceptCall = gameInOpenersMajor;

/** Alias: game try reject produces the same call as preemptive raise (3M). */
export const gameTryRejectCall = threeOfOpenersMajor;

/** Dynamic call for opener rebid game: return 4M of opener's own suit. */
export function openerRebidGame(ctx: BiddingContext): Call {
  const strain = asMajor(seatFirstBidStrain(ctx));
  if (!strain) return pass;
  return { type: "bid", level: 4, strain };
}

/** Dynamic call for opener rebid signoff: return 3M of opener's own suit. */
export function openerRebidSignoff(ctx: BiddingContext): Call {
  const strain = asMajor(seatFirstBidStrain(ctx));
  if (!strain) return pass;
  return { type: "bid", level: 3, strain };
}

/** Dynamic call for splinter: 3S after 1H, 3H after 1S (the OTHER major). */
export function splinterCall(ctx: BiddingContext): Call {
  const strain = asMajor(partnerOpeningStrain(ctx));
  if (!strain) return pass;
  // Splinter is the other major at the 3 level
  const otherMajor = strain === BidSuit.Hearts ? BidSuit.Spades : BidSuit.Hearts;
  return { type: "bid", level: 3, strain: otherMajor };
}

// ─── Splinter continuation helpers ───────────────────────────

/** Dynamic call for splinter relay: 3NT after 1H-P-3S, 3S after 1S-P-3H. */
export function splinterRelayCall(ctx: BiddingContext): Call {
  const strain = asMajor(seatFirstBidStrain(ctx));
  if (!strain) return pass;
  // After 1H opening, relay is 3NT; after 1S opening, relay is 3S
  if (strain === BidSuit.Hearts) return { type: "bid", level: 3, strain: BidSuit.NoTrump };
  return { type: "bid", level: 3, strain: BidSuit.Spades };
}

// SUIT_ORDER: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs
const SUIT_INDEX_TO_BIDSUIT: BidSuit[] = [BidSuit.Spades, BidSuit.Hearts, BidSuit.Diamonds, BidSuit.Clubs];

/** Find the suit where responder has shortage (singleton or void), excluding the trump suit. */
export function findShortageSuit(ctx: BiddingContext): number | null {
  const trumpStrain = asMajor(partnerOpeningStrain(ctx));
  if (!trumpStrain) return null;
  const trumpIndex = trumpStrain === BidSuit.Spades ? 0 : 1;
  for (let i = 0; i < 4; i++) {
    if (i === trumpIndex) continue;
    if (ctx.evaluation.shape[i]! <= 1) return i;
  }
  return null;
}

/**
 * Dynamic call for splinter shortness disclosure.
 * After 1H-P-3S-P-3NT(relay)-P: responder shows 4C=clubs, 4D=diamonds, 4H=spades shortage
 * After 1S-P-3H-P-3S(relay)-P: responder shows 3NT=clubs, 4C=diamonds, 4D=hearts shortage
 */
export function splinterDisclosureCall(ctx: BiddingContext): Call {
  const trumpStrain = asMajor(partnerOpeningStrain(ctx));
  if (!trumpStrain) return pass;
  const shortIdx = findShortageSuit(ctx);
  if (shortIdx === null) return pass;

  // Step responses: the non-trump suits in ascending order map to step bids
  // For 1H opening (trump=hearts, idx=1): non-trump suits are clubs(3), diamonds(2), spades(0)
  //   Step order: clubs→4C, diamonds→4D, spades→4H
  // For 1S opening (trump=spades, idx=0): non-trump suits are clubs(3), diamonds(2), hearts(1)
  //   Step order: clubs→3NT, diamonds→4C, hearts→4D
  if (trumpStrain === BidSuit.Hearts) {
    // After 1H: non-trump = clubs(3), diamonds(2), spades(0)
    const stepBids: Call[] = [
      { type: "bid", level: 4, strain: BidSuit.Clubs },    // clubs shortage
      { type: "bid", level: 4, strain: BidSuit.Diamonds },  // diamonds shortage
      { type: "bid", level: 4, strain: BidSuit.Hearts },    // spades shortage (4H = hearts bid used as code for spade shortage)
    ];
    const suitOrder = [3, 2, 0]; // clubs, diamonds, spades
    const step = suitOrder.indexOf(shortIdx);
    if (step >= 0) return stepBids[step]!;
  } else {
    // After 1S: non-trump = clubs(3), diamonds(2), hearts(1)
    const stepBids: Call[] = [
      { type: "bid", level: 3, strain: BidSuit.NoTrump },   // clubs shortage
      { type: "bid", level: 4, strain: BidSuit.Clubs },     // diamonds shortage
      { type: "bid", level: 4, strain: BidSuit.Diamonds },   // hearts shortage
    ];
    const suitOrder = [3, 2, 1]; // clubs, diamonds, hearts
    const step = suitOrder.indexOf(shortIdx);
    if (step >= 0) return stepBids[step]!;
  }
  return pass;
}

// ─── Help-suit game try helpers ──────────────────────────────

/**
 * Find opener's weakest side suit (fewest cards, excluding the trump suit)
 * for a help-suit game try.
 */
export function helpSuitGameTryCall(ctx: BiddingContext): Call {
  const trumpStrain = asMajor(seatFirstBidStrain(ctx));
  if (!trumpStrain) return pass;
  const trumpIndex = trumpStrain === BidSuit.Spades ? 0 : 1;

  // Find the weakest (shortest) non-trump suit — that's where we need help
  let weakestIdx = -1;
  let weakestLen = 14;
  for (let i = 0; i < 4; i++) {
    if (i === trumpIndex) continue;
    const len = ctx.evaluation.shape[i]!;
    if (len < weakestLen) {
      weakestLen = len;
      weakestIdx = i;
    }
  }
  if (weakestIdx < 0) return pass;

  const strain = SUIT_INDEX_TO_BIDSUIT[weakestIdx]!;
  // Help-suit game try must be at 3-level, above 3C (constructive)
  // All non-trump suits at 3-level are legal after 3C
  return { type: "bid", level: 3, strain };
}
