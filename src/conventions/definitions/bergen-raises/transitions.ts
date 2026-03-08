// Bergen Raises dialogue transition rules.
// Composed with baseline rules in config:
//   transitionRules: [...bergenTransitionRules, ...baselineTransitionRules]

import type { TransitionRule } from "../../core/dialogue/dialogue-transitions";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { partnerOfOpener } from "../../core/dialogue/helpers";

function isMajorOpening(call: Call): boolean {
  return (
    call.type === "bid" &&
    call.level === 1 &&
    (call.strain === BidSuit.Hearts || call.strain === BidSuit.Spades)
  );
}

export const bergenTransitionRules: readonly TransitionRule[] = [
  // Detect 1H/1S opening — sets familyId, stores opener's major and openerSeat
  {
    id: "bergen-major-opening",
    matches(state: DialogueState, entry) {
      const { call } = entry;
      return state.familyId === null && isMajorOpening(call);
    },
    effects(_state: DialogueState, entry) {
      const { call, seat } = entry;
      const strain = call.type === "bid" ? call.strain : null;
      return {
        setFamilyId: "bergen",
        mergeConventionData: { openerMajor: strain, openerSeat: seat },
      };
    },
  },

  // Bergen responses set agreed strain (partner of opener only)
  {
    id: "bergen-constructive",
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return (
        state.familyId === "bergen" &&
        call.type === "bid" &&
        call.level === 3 &&
        call.strain === BidSuit.Clubs &&
        partnerOfOpener(state, seat)
      );
    },
    effects(state: DialogueState) {
      return {
        mergeConventionData: {
          ...state.conventionData,
          responseType: "constructive",
        },
      };
    },
  },

  {
    id: "bergen-limit",
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return (
        state.familyId === "bergen" &&
        call.type === "bid" &&
        call.level === 3 &&
        call.strain === BidSuit.Diamonds &&
        partnerOfOpener(state, seat)
      );
    },
    effects(state: DialogueState) {
      return {
        mergeConventionData: {
          ...state.conventionData,
          responseType: "limit",
        },
      };
    },
  },
];
