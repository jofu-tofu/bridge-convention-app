import type { Call, ContractBid } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import type { BiddingContext } from "../../core/types";
import {
  partnerOpeningStrain,
  seatFirstBidStrain,
  partnerRespondedMajor,
  lastBid,
  bidIsHigher,
} from "../../core/conditions";
import { createIntentBidFactory } from "../../core/intent/intent-node";
import type { IntentNode } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";

export const saycBid = createIntentBidFactory("sayc");

import { auctionMatchesExact } from "../../../engine/auction-helpers";

const pass: Call = { type: "pass" };

function makeBid(
  level: ContractBid["level"],
  strain: BidSuit,
): Call {
  return { type: "bid", level, strain };
}

// ─── Dynamic call functions ─────────────────────────────────

export function respondRaiseMajorCall(ctx: BiddingContext): Call {
  const strain = partnerOpeningStrain(ctx);
  if (!strain) return pass;
  return makeBid(2, strain);
}

export function respondJumpRaiseMajorCall(ctx: BiddingContext): Call {
  const strain = partnerOpeningStrain(ctx);
  if (!strain) return pass;
  return makeBid(3, strain);
}

export function respondGameRaiseMajorCall(ctx: BiddingContext): Call {
  const strain = partnerOpeningStrain(ctx);
  if (!strain) return pass;
  return makeBid(4, strain);
}

export function rebid4mAfterRaiseCall(ctx: BiddingContext): Call {
  const strain = seatFirstBidStrain(ctx);
  if (!strain) return pass;
  return makeBid(4, strain);
}

export function rebid3mInviteCall(ctx: BiddingContext): Call {
  const strain = seatFirstBidStrain(ctx);
  if (!strain) return pass;
  return makeBid(3, strain);
}

export function rebidRaisePartnerMajorCall(ctx: BiddingContext): Call {
  const partnerMajor = partnerRespondedMajor(ctx);
  if (!partnerMajor) return pass;
  return makeBid(2, partnerMajor);
}

export function rebidOwnSuitCall(ctx: BiddingContext): Call {
  const strain = seatFirstBidStrain(ctx);
  if (!strain) return pass;
  return makeBid(2, strain);
}

function findBestOvercallSuit(
  ctx: BiddingContext,
  level: 1 | 2,
): Call {
  const lb = lastBid(ctx);
  if (!lb) return pass;
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
      bidIsHigher(level, suitStrains[i]!, lb) &&
      len > bestLen
    ) {
      bestLen = len;
      bestIdx = i;
    }
  }
  if (bestIdx === -1) return pass;
  return makeBid(level, suitStrains[bestIdx]!);
}

export function overcall1LevelCall(ctx: BiddingContext): Call {
  return findBestOvercallSuit(ctx, 1);
}

export function overcall2LevelCall(ctx: BiddingContext): Call {
  return findBestOvercallSuit(ctx, 2);
}

// ─── Weak two response helpers ──────────────────────────────

/** Raise partner's weak two to the 3-level in the same suit. */
export function respondWeakRaiseCall(ctx: BiddingContext): Call {
  const strain = partnerOpeningStrain(ctx);
  if (!strain) return pass;
  return makeBid(3, strain);
}

// ─── Jacoby Transfer acceptance ─────────────────────────────

/** Opener accepts Jacoby Transfer: after 1NT-P-2D-P bid 2H, after 1NT-P-2H-P bid 2S. */
export function openerAcceptTransferCall(ctx: BiddingContext): Call {
  if (auctionMatchesExact(ctx.auction, ["1NT", "P", "2D", "P"])) {
    return makeBid(2, BidSuit.Hearts);
  }
  if (auctionMatchesExact(ctx.auction, ["1NT", "P", "2H", "P"])) {
    return makeBid(2, BidSuit.Spades);
  }
  return pass;
}

// SAYC catch-all: every terminal in SAYC produces Pass (not fallback/null)
// because SAYC is a catch-all convention — any hand that enters produces a bid or pass.
// Each call site passes a unique context string to avoid duplicate nodeId errors.
export const saycPass = (context: string): IntentNode => saycBid(`sayc-pass-${context}`, "Passes with no suitable action available", { type: SemanticIntentType.Signoff, params: {} }, (): Call => pass);
