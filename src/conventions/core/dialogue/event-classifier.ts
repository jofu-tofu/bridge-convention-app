// Event classifier — classifies an auction entry with semantic metadata.
// Pure function, additive to the dialogue system. Existing transition rules
// are NOT required to use this; it's available for optional adoption.

import type { AuctionEntry, Seat, Auction } from "../../../engine/types";
import { partnerSeat } from "../../../engine/constants";
import { areSamePartnership } from "./helpers";

export interface ClassifiedEntry {
  readonly actor: "self" | "partner" | "lho" | "rho";
  readonly actionKind: "pass" | "double" | "redouble" | "bid";
  readonly bidNature: "natural" | "artificial" | "unknown";
  readonly interferenceKind: "none" | "double" | "natural_overcall" | "artificial" | "jump";
  readonly level?: number;
  readonly strain?: string;
}

// Clockwise seat order for LHO/RHO determination
const SEAT_ORDER: Seat[] = ["N", "E", "S", "W"] as Seat[];

function seatIndex(seat: Seat): number {
  return SEAT_ORDER.indexOf(seat);
}

function lhoOf(seat: Seat): Seat {
  return SEAT_ORDER[(seatIndex(seat) + 1) % 4]!;
}

function determineActor(
  entrySeat: Seat,
  evaluatingSeat: Seat,
): "self" | "partner" | "lho" | "rho" {
  if (entrySeat === evaluatingSeat) return "self";
  if (entrySeat === partnerSeat(evaluatingSeat)) return "partner";
  if (entrySeat === lhoOf(evaluatingSeat)) return "lho";
  return "rho";
}

function determineActionKind(entry: AuctionEntry): "pass" | "double" | "redouble" | "bid" {
  switch (entry.call.type) {
    case "pass": return "pass";
    case "double": return "double";
    case "redouble": return "redouble";
    case "bid": return "bid";
  }
}

function determineInterferenceKind(
  entry: AuctionEntry,
  evaluatingSeat: Seat,
  auction: Auction,
): "none" | "double" | "natural_overcall" | "artificial" | "jump" {
  // Only opponent actions are interference
  if (areSamePartnership(entry.seat, evaluatingSeat)) return "none";

  if (entry.call.type === "pass" || entry.call.type === "redouble") return "none";
  if (entry.call.type === "double") return "double";

  // It's a bid by an opponent — determine if it's a jump
  if (entry.call.type === "bid") {
    // Find the last contract bid before this entry
    const entryIndex = auction.entries.indexOf(entry);
    let lastBidLevel = 0;
    for (let i = 0; i < entryIndex; i++) {
      const prev = auction.entries[i]!;
      if (prev.call.type === "bid") {
        lastBidLevel = prev.call.level;
      }
    }

    // A jump is bidding 2+ levels above what's needed
    if (entry.call.level > lastBidLevel + 1) {
      return "jump";
    }
    return "natural_overcall";
  }

  return "none";
}

/**
 * Classify an auction entry with semantic metadata.
 * Pure function — no side effects, no state mutation.
 */
export function classifyAuctionEntry(
  entry: AuctionEntry,
  evaluatingSeat: Seat,
  auction: Auction,
): ClassifiedEntry {
  const actor = determineActor(entry.seat, evaluatingSeat);
  const actionKind = determineActionKind(entry);
  const interferenceKind = determineInterferenceKind(entry, evaluatingSeat, auction);

  return {
    actor,
    actionKind,
    bidNature: actionKind === "bid" ? "unknown" : "unknown",
    interferenceKind,
    level: entry.call.type === "bid" ? entry.call.level : undefined,
    strain: entry.call.type === "bid" ? entry.call.strain : undefined,
  };
}
