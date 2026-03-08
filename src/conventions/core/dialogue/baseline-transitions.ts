// Baseline transition rules — universal patterns that apply regardless of convention.
// Family-specific rules go in convention definition folders.
// Convention configs compose: [...familyRules, ...baselineTransitionRules].

import type { TransitionRule } from "./dialogue-transitions";
import { CaptainRole, CompetitionMode, InterferenceKind, SystemMode } from "./dialogue-state";
import type { DialogueState } from "./dialogue-state";
import { BidSuit } from "../../../engine/types";
import type { Call, Seat } from "../../../engine/types";
import { areSamePartnership } from "./helpers";

/** Get the opener seat from conventionData, if tracked. */
function getOpenerSeat(state: DialogueState): Seat | undefined {
  return state.conventionData["openerSeat"] as Seat | undefined;
}

/** Check if the bidding seat is an opponent of the opener's partnership. */
function isOpponentOfOpener(state: DialogueState, biddingSeat: Seat): boolean {
  const openerSeat = getOpenerSeat(state);
  if (!openerSeat) return false;
  return !areSamePartnership(openerSeat, biddingSeat);
}

/** Check if a call is a 1NT opening bid. */
function is1NT(call: Call): boolean {
  return call.type === "bid" && call.level === 1 && call.strain === BidSuit.NoTrump;
}

/** Check if a call is a 2NT opening bid. */
function is2NT(call: Call): boolean {
  return call.type === "bid" && call.level === 2 && call.strain === BidSuit.NoTrump;
}

export const baselineTransitionRules: readonly TransitionRule[] = [
  // Detect 1NT opening (no family active yet)
  {
    id: "detect-1nt-opening",
    matches(state: DialogueState, entry) {
      const { call } = entry;
      return state.familyId === null && is1NT(call);
    },
    effects(_state: DialogueState, entry) {
      const { seat } = entry;
      return {
        setFamilyId: "1nt",
        setCaptain: CaptainRole.Responder,
        setSystemMode: SystemMode.On,
        mergeConventionData: { openerSeat: seat },
      };
    },
  },

  // Detect 2NT opening (no family active yet)
  {
    id: "detect-2nt-opening",
    matches(state: DialogueState, entry) {
      const { call } = entry;
      return state.familyId === null && is2NT(call);
    },
    effects(_state: DialogueState, entry) {
      const { seat } = entry;
      return {
        setFamilyId: "2nt",
        setCaptain: CaptainRole.Responder,
        setSystemMode: SystemMode.On,
        mergeConventionData: { openerSeat: seat },
      };
    },
  },

  // Opponent doubles while system is active — system off
  {
    id: "opponent-double",
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return call.type === "double" && isOpponentOfOpener(state, seat);
    },
    effects(_state: DialogueState, entry) {
      const { call, seat } = entry;
      return {
        setCompetitionMode: CompetitionMode.Doubled,
        setSystemMode: SystemMode.Off,
        setInterferenceDetail: { call, seat, isNatural: true, kind: InterferenceKind.Unknown },
      };
    },
  },

  // Opponent makes a contract bid while system is active — system off
  {
    id: "opponent-overcall",
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return (
        state.familyId !== null &&
        state.systemMode === SystemMode.On &&
        call.type === "bid" &&
        isOpponentOfOpener(state, seat)
      );
    },
    effects(_state: DialogueState, entry) {
      const { call, seat } = entry;
      return {
        setCompetitionMode: CompetitionMode.Overcalled,
        setSystemMode: SystemMode.Off,
        setInterferenceDetail: { call, seat, isNatural: true, kind: InterferenceKind.NaturalOvercall },
      };
    },
  },

  // Pass — no state change
  {
    id: "pass-no-change",
    matches(_state: DialogueState, entry) {
      const { call } = entry;
      return call.type === "pass";
    },
    effects() {
      return {};
    },
  },

  // Ultimate catch-all — any unmatched bid leaves state unchanged
  {
    id: "catch-all-no-change",
    matches() {
      return true;
    },
    effects() {
      return {};
    },
  },
];
