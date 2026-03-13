import type { Auction, Seat } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";

/**
 * Activation filter for the 1NT response bundle.
 * Round 1 fast-path: after 1NT opening, both conventions are attempted.
 * The orchestrator evaluates all members and filters by protocol match.
 */
export function ntActivationFilter(
  auction: Auction,
  _seat: Seat,
): readonly string[] {
  // Check if 1NT was bid
  const has1NT = auction.entries.some(
    (e) => e.call.type === "bid" && e.call.level === 1 && e.call.strain === BidSuit.NoTrump,
  );
  if (!has1NT) return [];
  // Both always attempted -- the protocol evaluator naturally filters
  return ["jacoby-transfers", "stayman"];
}
