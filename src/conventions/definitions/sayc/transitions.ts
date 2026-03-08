// SAYC dialogue transition rules.
// SAYC is a full bidding system, not a single convention. The transition
// rules detect the opening type and set familyId accordingly, then track
// response types, forcing states, agreed strain, and competitive actions.
// Composed with baseline rules in config via two-pass mode:
//   transitionRules: saycTransitionRules (convention pass)
//   baselineRules: baselineTransitionRules (backfill pass)

import { BidSuit, Suit } from "../../../engine/types";
import type { Seat } from "../../../engine/types";
import type { TransitionRule } from "../../core/dialogue/dialogue-transitions";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import { ForcingState } from "../../../core/contracts";
import { SystemMode } from "../../core/dialogue/dialogue-state";
import { areSamePartnership, isOpenerSeat } from "../../core/dialogue/helpers";

// ─── Helpers ────────────────────────────────────────────────

/** Strain rank for determining minimum bid level in a new suit. */
const STRAIN_RANK: Record<string, number> = {
  [BidSuit.Clubs]: 1,
  [BidSuit.Diamonds]: 2,
  [BidSuit.Hearts]: 3,
  [BidSuit.Spades]: 4,
  [BidSuit.NoTrump]: 5,
};

const BIDSUIT_TO_SUIT: Readonly<Record<string, Suit>> = {
  [BidSuit.Clubs]: Suit.Clubs,
  [BidSuit.Diamonds]: Suit.Diamonds,
  [BidSuit.Hearts]: Suit.Hearts,
  [BidSuit.Spades]: Suit.Spades,
};

function isMajorStrain(strain: BidSuit): boolean {
  return strain === BidSuit.Hearts || strain === BidSuit.Spades;
}

/** True if seat is partner of opener but NOT the opener themselves. */
function isResponderSeat(state: DialogueState, seat: Seat): boolean {
  const opener = state.conventionData["openerSeat"] as Seat | undefined;
  if (opener === undefined) return false;
  return areSamePartnership(seat, opener) && !isOpenerSeat(state, seat);
}

/**
 * Check if a new-suit response is a jump shift (bid higher than minimum level).
 * After a 1-level opening, a new suit that outranks the opening suit can be
 * bid at level 1 (minimum), so level 2+ is a jump. A lower-ranking new suit
 * requires level 2 as minimum, so level 3+ is a jump.
 */
function isJumpShift(openingStrain: BidSuit, responseStrain: BidSuit, responseLevel: number): boolean {
  const minLevel = STRAIN_RANK[responseStrain]! > STRAIN_RANK[openingStrain]! ? 1 : 2;
  return responseLevel > minLevel;
}

// ─── Transition Rules ───────────────────────────────────────

export const saycTransitionRules: readonly TransitionRule[] = [
  // ─── Opening family detection ─────────────────────────────

  // 1NT opening
  {
    id: "sayc-1nt-opening",
    matchDescriptor: { callType: "bid", level: 1, strain: BidSuit.NoTrump },
    matches(state, entry) {
      const { call } = entry;
      return (
        state.familyId === null &&
        call.type === "bid" &&
        call.level === 1 &&
        call.strain === BidSuit.NoTrump
      );
    },
    effects(_state, entry) {
      return {
        setFamilyId: "sayc-1nt",
        setSystemMode: SystemMode.On,
        mergeConventionData: { openerSeat: entry.seat },
      };
    },
  },

  // 2NT opening
  {
    id: "sayc-2nt-opening",
    matchDescriptor: { callType: "bid", level: 2, strain: BidSuit.NoTrump },
    matches(state, entry) {
      const { call } = entry;
      return (
        state.familyId === null &&
        call.type === "bid" &&
        call.level === 2 &&
        call.strain === BidSuit.NoTrump
      );
    },
    effects(_state, entry) {
      return {
        setFamilyId: "sayc-2nt",
        setSystemMode: SystemMode.On,
        mergeConventionData: { openerSeat: entry.seat },
      };
    },
  },

  // 2C strong opening — game forcing
  {
    id: "sayc-2c-opening",
    matchDescriptor: { callType: "bid", level: 2, strain: BidSuit.Clubs },
    matches(state, entry) {
      const { call } = entry;
      return (
        state.familyId === null &&
        call.type === "bid" &&
        call.level === 2 &&
        call.strain === BidSuit.Clubs
      );
    },
    effects(_state, entry) {
      return {
        setFamilyId: "sayc-2c",
        setForcingState: ForcingState.GameForcing,
        mergeConventionData: { openerSeat: entry.seat },
      };
    },
  },

  // Weak two opening (2D/2H/2S — not 2C which is strong, not 2NT)
  {
    id: "sayc-weak-two-opening",
    matchDescriptor: { callType: "bid", level: 2 },
    matches(state, entry) {
      const { call } = entry;
      return (
        state.familyId === null &&
        call.type === "bid" &&
        call.level === 2 &&
        call.strain !== BidSuit.Clubs &&
        call.strain !== BidSuit.NoTrump
      );
    },
    effects(_state, entry) {
      const strain = entry.call.type === "bid" ? entry.call.strain : null;
      return {
        setFamilyId: "sayc-weak",
        mergeConventionData: { openerSeat: entry.seat, openingSuit: strain },
      };
    },
  },

  // Suit opening at 1-level (major or minor)
  {
    id: "sayc-suit-opening",
    matchDescriptor: { callType: "bid", level: 1 },
    matches(state, entry) {
      const { call } = entry;
      return (
        state.familyId === null &&
        call.type === "bid" &&
        call.level === 1 &&
        call.strain !== BidSuit.NoTrump
      );
    },
    effects(_state, entry) {
      const { call } = entry;
      const strain = call.type === "bid" ? call.strain : null;
      const openingFamily = strain && isMajorStrain(strain) ? "major" : "minor";
      return {
        setFamilyId: "sayc-suit",
        setSystemMode: SystemMode.On,
        mergeConventionData: { openerSeat: entry.seat, openingSuit: strain, openingFamily },
      };
    },
  },

  // Preempt opening at 3-level
  {
    id: "sayc-preempt-opening",
    matchDescriptor: { callType: "bid", level: 3 },
    matches(state, entry) {
      const { call } = entry;
      return (
        state.familyId === null &&
        call.type === "bid" &&
        call.level === 3 &&
        call.strain !== BidSuit.NoTrump
      );
    },
    effects(_state, entry) {
      const strain = entry.call.type === "bid" ? entry.call.strain : null;
      return {
        setFamilyId: "sayc-preempt",
        mergeConventionData: { openerSeat: entry.seat, openingSuit: strain },
      };
    },
  },

  // ─── Response type classification ─────────────────────────
  // Order matters: raise → 1NT → jump shift → new suit (first-match-wins)

  // Raise of opener's suit → agreed strain
  {
    id: "sayc-raise-agreed",
    matchDescriptor: { callType: "bid", actorRelation: "partner-of-opener" },
    matches(state, entry) {
      const { call, seat } = entry;
      return (
        state.familyId === "sayc-suit" &&
        call.type === "bid" &&
        isResponderSeat(state, seat) &&
        call.strain === state.conventionData["openingSuit"]
      );
    },
    effects(state) {
      const openingSuit = state.conventionData["openingSuit"] as BidSuit;
      const suit = BIDSUIT_TO_SUIT[openingSuit];
      return {
        mergeConventionData: { responseType: "raise" },
        ...(suit ? { setAgreedStrain: { type: "suit" as const, suit, confidence: "agreed" as const } } : {}),
      };
    },
  },

  // 1NT response — non-forcing
  {
    id: "sayc-1nt-response",
    matchDescriptor: { callType: "bid", level: 1, strain: BidSuit.NoTrump, actorRelation: "partner-of-opener" },
    matches(state, entry) {
      const { call, seat } = entry;
      return (
        state.familyId === "sayc-suit" &&
        call.type === "bid" &&
        call.level === 1 &&
        call.strain === BidSuit.NoTrump &&
        isResponderSeat(state, seat)
      );
    },
    effects() {
      return {
        setForcingState: ForcingState.Nonforcing,
        mergeConventionData: { responseType: "1nt" },
      };
    },
  },

  // Jump shift response — game forcing
  {
    id: "sayc-jump-shift-response",
    matchDescriptor: { callType: "bid", actorRelation: "partner-of-opener" },
    matches(state, entry) {
      const { call, seat } = entry;
      if (
        state.familyId !== "sayc-suit" ||
        call.type !== "bid" ||
        call.strain === BidSuit.NoTrump ||
        !isResponderSeat(state, seat)
      ) return false;
      const openingSuit = state.conventionData["openingSuit"] as BidSuit;
      if (call.strain === openingSuit) return false;
      return isJumpShift(openingSuit, call.strain, call.level);
    },
    effects() {
      return {
        setForcingState: ForcingState.GameForcing,
        mergeConventionData: { responseType: "jump-shift" },
      };
    },
  },

  // New suit response (not a jump shift) — forcing one round
  {
    id: "sayc-new-suit-response",
    matchDescriptor: { callType: "bid", actorRelation: "partner-of-opener" },
    matches(state, entry) {
      const { call, seat } = entry;
      if (
        state.familyId !== "sayc-suit" ||
        call.type !== "bid" ||
        call.strain === BidSuit.NoTrump ||
        !isResponderSeat(state, seat)
      ) return false;
      const openingSuit = state.conventionData["openingSuit"] as BidSuit;
      return call.strain !== openingSuit;
    },
    effects() {
      return {
        setForcingState: ForcingState.ForcingOneRound,
        mergeConventionData: { responseType: "new-suit" },
      };
    },
  },

  // ─── Competitive action tracking ──────────────────────────

  // Opponent doubles 1NT — systems OFF
  {
    id: "sayc-1nt-doubled",
    matchDescriptor: { familyId: "sayc-1nt", callType: "double", actorRelation: "opponent" },
    matches(state, entry) {
      const { call, seat } = entry;
      return (
        state.familyId === "sayc-1nt" &&
        call.type === "double" &&
        !areSamePartnership(seat, state.conventionData["openerSeat"] as Seat)
      );
    },
    effects() {
      return {
        setSystemMode: SystemMode.Off,
        mergeConventionData: { interferenceType: "doubled" },
      };
    },
  },
];
