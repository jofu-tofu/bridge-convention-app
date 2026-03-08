// Stayman-specific dialogue transition rules.
// These are composed with baseline rules in config:
//   transitionRules: [...staymanTransitionRules, ...baselineTransitionRules]

import type { TransitionRule } from "../../core/dialogue/dialogue-transitions";
import {
  ForcingState,
  ObligationKind,
  SystemMode,
} from "../../core/dialogue/dialogue-state";
import { STAYMAN_CAPABILITY } from "./constants";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import type { Call, Seat } from "../../../engine/types";
import { BidSuit, Suit } from "../../../engine/types";
import { areSamePartnership, partnerOfOpener, isOpenerSeat } from "../../core/dialogue/helpers";

function is2C(call: Call): boolean {
  return call.type === "bid" && call.level === 2 && call.strain === BidSuit.Clubs;
}

function is3C(call: Call): boolean {
  return call.type === "bid" && call.level === 3 && call.strain === BidSuit.Clubs;
}

function is2H(call: Call): boolean {
  return call.type === "bid" && call.level === 2 && call.strain === BidSuit.Hearts;
}

function is2S(call: Call): boolean {
  return call.type === "bid" && call.level === 2 && call.strain === BidSuit.Spades;
}

function is2D(call: Call): boolean {
  return call.type === "bid" && call.level === 2 && call.strain === BidSuit.Diamonds;
}

function is3H(call: Call): boolean {
  return call.type === "bid" && call.level === 3 && call.strain === BidSuit.Hearts;
}

function is3S(call: Call): boolean {
  return call.type === "bid" && call.level === 3 && call.strain === BidSuit.Spades;
}

function is3D(call: Call): boolean {
  return call.type === "bid" && call.level === 3 && call.strain === BidSuit.Diamonds;
}

export const staymanTransitionRules: readonly TransitionRule[] = [
  // 1NT doubled by opponent: Stayman system modified (still available with 8+ HCP + 4-card major).
  // Only sets systemMode=Modified. Baseline backfills competitionMode + interferenceDetail
  // via two-pass mode (config.baselineRules is set).
  {
    id: "1nt-doubled",
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return (
        state.familyId === "1nt" &&
        call.type === "double" &&
        !areSamePartnership(seat, state.conventionData["openerSeat"] as Seat)
      );
    },
    effects() {
      return {
        setSystemCapability: { [STAYMAN_CAPABILITY]: SystemMode.Modified },
      };
    },
  },

  // Stayman ask: 2C after 1NT family (partner of opener only)
  {
    id: "1nt-stayman-ask",
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return state.familyId === "1nt" && is2C(call) && partnerOfOpener(state, seat);
    },
    effects() {
      return {
        setObligation: { kind: ObligationKind.ShowMajor, obligatedSide: "opener" as const },
        setForcingState: ForcingState.ForcingOneRound,
      };
    },
  },

  // Stayman ask: 3C after 2NT family (partner of opener only)
  {
    id: "2nt-stayman-ask",
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return state.familyId === "2nt" && is3C(call) && partnerOfOpener(state, seat);
    },
    effects() {
      return {
        setObligation: { kind: ObligationKind.ShowMajor, obligatedSide: "opener" as const },
        setForcingState: ForcingState.ForcingOneRound,
      };
    },
  },

  // Opener responds with hearts (shows 4+ hearts)
  {
    id: "1nt-response-hearts",
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return (
        state.familyId === "1nt" &&
        state.obligation.kind === ObligationKind.ShowMajor &&
        (is2H(call) || is3H(call)) &&
        isOpenerSeat(state, seat)
      );
    },
    effects() {
      return {
        setObligation: { kind: ObligationKind.None, obligatedSide: "opener" as const },
        setForcingState: ForcingState.Nonforcing,
        setAgreedStrain: { type: "suit" as const, suit: Suit.Hearts, confidence: "tentative" as const },
        mergeConventionData: { showed: "hearts" },
      };
    },
  },

  // Opener responds with spades (shows 4+ spades, denies hearts)
  {
    id: "1nt-response-spades",
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return (
        state.familyId === "1nt" &&
        state.obligation.kind === ObligationKind.ShowMajor &&
        (is2S(call) || is3S(call)) &&
        isOpenerSeat(state, seat)
      );
    },
    effects() {
      return {
        setObligation: { kind: ObligationKind.None, obligatedSide: "opener" as const },
        setForcingState: ForcingState.Nonforcing,
        setAgreedStrain: { type: "suit" as const, suit: Suit.Spades, confidence: "tentative" as const },
        mergeConventionData: { showed: "spades" },
      };
    },
  },

  // Opener responds with denial (2D/3D — no 4-card major)
  {
    id: "1nt-response-denial",
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return (
        state.familyId === "1nt" &&
        state.obligation.kind === ObligationKind.ShowMajor &&
        (is2D(call) || is3D(call)) &&
        isOpenerSeat(state, seat)
      );
    },
    effects() {
      return {
        setObligation: { kind: ObligationKind.None, obligatedSide: "opener" as const },
        setForcingState: ForcingState.Nonforcing,
        setAgreedStrain: { type: "none" as const },
        mergeConventionData: { showed: "denial" },
      };
    },
  },
];
