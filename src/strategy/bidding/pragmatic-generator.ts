// Pragmatic candidate generator — heuristic tactical bids beyond convention surfaces.
// Import boundary: engine/ types, inference/ PrivateBeliefState, and BiddingContext type only.
// NO runtime imports from conventions/core/ — only type imports.

import { BidSuit } from "../../engine/types";
import type { Auction, Call, ContractBid, Seat } from "../../engine/types";
import { isLegalCall } from "../../engine/auction";
import { SUIT_ORDER, partnerSeat } from "../../engine/constants";
import { callKey } from "../../engine/call-helpers";
import type { BiddingContext } from "../../core/contracts";
import type { PrivateBeliefState } from "../../inference/private-belief";
import { LEVEL_HCP_TABLE } from "./practical-scorer";

export enum DistortionType {
  ConservativeNTDowngrade = "conservative-nt-downgrade",
  CompetitiveOvercall = "competitive-overcall",
  ProtectiveDouble = "protective-double",
}

export interface PragmaticCandidate {
  readonly call: Call;
  readonly distortionType: DistortionType;
  readonly rationale: string;
  readonly legal: boolean;
}

/** Map SUIT_ORDER index to BidSuit. SUIT_ORDER = [S, H, D, C]. */
const SUIT_INDEX_TO_BIDSUIT: readonly BidSuit[] = [
  BidSuit.Spades,
  BidSuit.Hearts,
  BidSuit.Diamonds,
  BidSuit.Clubs,
];

/**
 * Generate pragmatic (tactical) candidates that convention surfaces don't produce.
 * Returns candidates with legality checks. Deduplicates against existingCalls.
 */
export function generatePragmaticCandidates(
  context: BiddingContext,
  privatePosterior: PrivateBeliefState,
  existingCalls: ReadonlySet<string>,
): PragmaticCandidate[] {
  const results: PragmaticCandidate[] = [];

  const ntDowngrade = tryConservativeNTDowngrade(context, privatePosterior, existingCalls);
  if (ntDowngrade) results.push(ntDowngrade);

  const overcalls = tryCompetitiveOvercalls(context, existingCalls);
  results.push(...overcalls);

  const protDouble = tryProtectiveDouble(context, existingCalls);
  if (protDouble) results.push(protDouble);

  return results;
}

// ─── ConservativeNTDowngrade ──────────────────────────────────

function findPartnerNTBid(auction: Auction, seat: Seat): ContractBid | undefined {
  const partner = partnerSeat(seat);
  for (let i = auction.entries.length - 1; i >= 0; i--) {
    const e = auction.entries[i]!;
    if (e.seat === partner && e.call.type === "bid" && e.call.strain === BidSuit.NoTrump) {
      return e.call;
    }
  }
  return undefined;
}

function tryConservativeNTDowngrade(
  context: BiddingContext,
  privatePosterior: PrivateBeliefState,
  existingCalls: ReadonlySet<string>,
): PragmaticCandidate | null {
  const partnerNT = findPartnerNTBid(context.auction, context.seat);
  if (!partnerNT) return null;

  const level = partnerNT.level;
  const downgradedLevel = level - 1;
  if (downgradedLevel < 1) return null;

  const ownHcp = context.evaluation.hcp;
  const partnerMinHcp = privatePosterior.partnerHcpRange.min;
  const combinedHcp = ownHcp + partnerMinHcp;
  const floor = LEVEL_HCP_TABLE[level] ?? 20;

  // "Within 2" means combined is within 2 points of the floor
  if (Math.abs(combinedHcp - floor) > 2) return null;

  const downgradedCall: ContractBid = {
    type: "bid",
    level: downgradedLevel as ContractBid["level"],
    strain: BidSuit.NoTrump,
  };

  const key = callKey(downgradedCall);
  if (existingCalls.has(key)) return null;

  const legal = isLegalCall(context.auction, downgradedCall, context.seat);

  return {
    call: downgradedCall,
    distortionType: DistortionType.ConservativeNTDowngrade,
    rationale: `Combined HCP (${combinedHcp}) is marginal for ${level}NT — consider ${downgradedLevel}NT`,
    legal,
  };
}

// ─── CompetitiveOvercall ──────────────────────────────────────

function hasOpponentBid(auction: Auction, seat: Seat): boolean {
  const partner = partnerSeat(seat);
  for (const e of auction.entries) {
    if (e.seat !== seat && e.seat !== partner && e.call.type === "bid") {
      return true;
    }
  }
  return false;
}

function tryCompetitiveOvercalls(
  context: BiddingContext,
  existingCalls: ReadonlySet<string>,
): PragmaticCandidate[] {
  if (!hasOpponentBid(context.auction, context.seat)) return [];
  if (context.evaluation.hcp < 8) return [];

  const results: PragmaticCandidate[] = [];
  const shape = context.evaluation.shape;

  for (let i = 0; i < SUIT_ORDER.length; i++) {
    const suitLength = shape[i] ?? 0;
    if (suitLength < 5) continue;

    const bidSuit = SUIT_INDEX_TO_BIDSUIT[i]!;
    const overcall = findCheapestLegalBidInSuit(context.auction, context.seat, bidSuit);
    if (!overcall) continue;

    const key = callKey(overcall);
    if (existingCalls.has(key)) continue;

    results.push({
      call: overcall,
      distortionType: DistortionType.CompetitiveOvercall,
      rationale: `${suitLength}-card suit with ${context.evaluation.hcp} HCP — competitive overcall`,
      legal: true, // findCheapestLegalBidInSuit already checks legality
    });
  }

  return results;
}

function findCheapestLegalBidInSuit(auction: Auction, seat: Seat, strain: BidSuit): ContractBid | null {
  for (let level = 1; level <= 7; level++) {
    const call: ContractBid = {
      type: "bid",
      level: level as ContractBid["level"],
      strain,
    };
    if (isLegalCall(auction, call, seat)) {
      return call;
    }
  }
  return null;
}

// ─── ProtectiveDouble ─────────────────────────────────────────

function tryProtectiveDouble(
  context: BiddingContext,
  existingCalls: ReadonlySet<string>,
): PragmaticCandidate | null {
  if (existingCalls.has("X")) return null;
  if (context.evaluation.hcp < 10) return null;

  const entries = context.auction.entries;
  if (entries.length < 3) return null;

  // Last 3 entries: opponent-bid, pass, pass
  const last3 = entries.slice(-3);
  const opponentBid = last3[0]!;
  const pass1 = last3[1]!;
  const pass2 = last3[2]!;

  if (pass1.call.type !== "pass" || pass2.call.type !== "pass") return null;
  if (opponentBid.call.type !== "bid") return null;

  // Opponent must be on the other side
  const partner = partnerSeat(context.seat);
  if (opponentBid.seat === context.seat || opponentBid.seat === partner) return null;

  const opponentCall = opponentBid.call;
  if (opponentCall.level > 3) return null;

  const doubleCall: Call = { type: "double" };
  const legal = isLegalCall(context.auction, doubleCall, context.seat);
  if (!legal) return null;

  return {
    call: doubleCall,
    distortionType: DistortionType.ProtectiveDouble,
    rationale: `Passout seat protection — ${context.evaluation.hcp} HCP, opponent at ${opponentCall.level}-level`,
    legal: true,
  };
}
