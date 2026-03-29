/**
 * Capability Constraint Registry — maps capabilities to opener constraints,
 * default auctions, and dealer restrictions.
 *
 * Each capability archetype defines the "setup" for a convention: what the
 * opener's hand looks like, how the default auction is constructed, and
 * which seats may deal. The derivation system uses these to produce opener
 * constraints for deal generation.
 */

import { Seat, Suit, type Hand, type Deal, type SeatConstraint, type Auction } from "../../engine/types";
import { suitLengthOf } from "../../engine/hand-evaluator";
import { buildAuction } from "../../engine/auction-helpers";
import type { SystemConfig } from "./system-config";
import { TurnRole } from "../core/rule-module";
import {
  CAP_OPENING_1NT,
  CAP_OPENING_MAJOR,
  CAP_OPENING_WEAK_TWO,
  CAP_OPPONENT_1NT,
} from "./capability-vocabulary";

// ── Archetype interface ─────────────────────────────────────────────

export interface CapabilityArchetype {
  /** The seat that makes the opening action (opener or opponent). */
  readonly openerSeat: Seat;
  /** System-parameterized constraint for the opener's hand. */
  readonly openerConstraint: (sys: SystemConfig) => SeatConstraint;
  /** Build the default auction given the practitioner seat and optional deal. */
  readonly defaultAuction: (seat: Seat, deal?: Deal) => Auction | undefined;
  /** If set, drill infrastructure picks a random dealer from this list. */
  readonly allowedDealers?: readonly Seat[];
  /** The practitioner's turn role for identifying R1 surfaces. */
  readonly practitionerTurn: TurnRole | undefined;
  /** The practitioner's seat. */
  readonly practitionerSeat: Seat;
  /**
   * Minimum phase distance from initial to consider for R1 surfaces.
   * 0 for opening conventions (practitioner may act at initial phase).
   * 1 for opponent conventions (practitioner acts after opponent's opening).
   */
  readonly minPhaseDistance: number;
}

// ── Deal-dependent helpers ──────────────────────────────────────────

/** Determine which major suit the opener (North) should open based on hand. */
function longestMajor(hand: Hand): "H" | "S" {
  const h = suitLengthOf(hand, Suit.Hearts);
  const s = suitLengthOf(hand, Suit.Spades);
  return s > h ? "S" : "H";
}

/** Determine which weak-two suit North should open based on hand. */
function longestWeakTwoSuit(hand: Hand): "D" | "H" | "S" {
  const d = suitLengthOf(hand, Suit.Diamonds);
  const h = suitLengthOf(hand, Suit.Hearts);
  const s = suitLengthOf(hand, Suit.Spades);
  if (h >= s && h >= d) return "H";
  if (s >= d) return "S";
  return "D";
}

// ── Registry ────────────────────────────────────────────────────────

const ARCHETYPE_MAP = new Map<string, CapabilityArchetype>([
  [CAP_OPENING_1NT, {
    openerSeat: Seat.North,
    openerConstraint: (sys) => ({
      seat: Seat.North,
      minHcp: sys.ntOpening.minHcp,
      maxHcp: sys.ntOpening.maxHcp,
      balanced: true,
    }),
    defaultAuction: (seat) => {
      if (seat === Seat.South || seat === Seat.East)
        return buildAuction(Seat.North, ["1NT", "P"]);
      return undefined;
    },
    practitionerTurn: TurnRole.Responder,
    practitionerSeat: Seat.South,
    minPhaseDistance: 0,
  }],

  [CAP_OPENING_MAJOR, {
    openerSeat: Seat.North,
    openerConstraint: (sys) => ({
      seat: Seat.North,
      minHcp: 12,
      maxHcp: 21,
      minLengthAny: {
        [Suit.Hearts]: sys.openingRequirements.majorSuitMinLength,
        [Suit.Spades]: sys.openingRequirements.majorSuitMinLength,
      },
    }),
    defaultAuction: (seat, deal) => {
      if (seat === Seat.South || seat === Seat.East) {
        const openSuit = deal ? longestMajor(deal.hands[Seat.North]) : "H";
        return buildAuction(Seat.North, [`1${openSuit}`, "P"]);
      }
      return undefined;
    },
    practitionerTurn: TurnRole.Responder,
    practitionerSeat: Seat.South,
    minPhaseDistance: 0,
  }],

  [CAP_OPENING_WEAK_TWO, {
    openerSeat: Seat.North,
    openerConstraint: () => ({
      seat: Seat.North,
      minHcp: 5,
      maxHcp: 10,
      minLengthAny: { [Suit.Diamonds]: 6, [Suit.Hearts]: 6, [Suit.Spades]: 6 },
    }),
    defaultAuction: (seat, deal) => {
      if (seat === Seat.South || seat === Seat.East) {
        const openSuit = deal ? longestWeakTwoSuit(deal.hands[Seat.North]) : "H";
        return buildAuction(Seat.North, [`2${openSuit}`, "P"]);
      }
      return undefined;
    },
    allowedDealers: [Seat.North],
    practitionerTurn: TurnRole.Responder,
    practitionerSeat: Seat.South,
    minPhaseDistance: 0,
  }],

  [CAP_OPPONENT_1NT, {
    openerSeat: Seat.East,
    // Opponent's NT range is fixed at standard 15-17 — we're practicing
    // against opponents, not deriving from our own system's NT range
    openerConstraint: () => ({
      seat: Seat.East,
      minHcp: 15,
      maxHcp: 17,
    }),
    defaultAuction: (seat) => {
      if (seat === Seat.South || seat === Seat.West)
        return buildAuction(Seat.East, ["1NT"]);
      return undefined;
    },
    allowedDealers: [Seat.East],
    // DONT doesn't use turn matching — surfaces are scoped by phase + route
    practitionerTurn: undefined,
    practitionerSeat: Seat.South,
    minPhaseDistance: 1,  // Practitioner acts after opponent's opening
  }],
]);

// ── Public API ──────────────────────────────────────────────────────

/** Look up the archetype for a capability ID. */
export function getArchetype(capabilityId: string): CapabilityArchetype | undefined {
  return ARCHETYPE_MAP.get(capabilityId);
}

/** Whether a capability supports role selection (opener vs responder).
 *  True when opener and practitioner are in the same N/S partnership. */
export function archetypeSupportsRoleSelection(capabilityId: string): boolean {
  const arch = ARCHETYPE_MAP.get(capabilityId);
  if (!arch) return false;
  const NS = new Set([Seat.North, Seat.South]);
  return NS.has(arch.openerSeat) && NS.has(arch.practitionerSeat);
}

/** Get the first declared capability ID from a bundle's declaredCapabilities. */
export function getPrimaryCapability(
  declaredCapabilities?: Readonly<Record<string, string>>,
): string | undefined {
  if (!declaredCapabilities) return undefined;
  const keys = Object.keys(declaredCapabilities);
  return keys.length > 0 ? keys[0] : undefined;
}
