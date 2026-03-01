// Bergen Raises dialogue transition rules.
// Composed with baseline rules in config:
//   transitionRules: [...bergenTransitionRules, ...baselineTransitionRules]

import type { TransitionRule } from "../../core/dialogue/dialogue-transitions";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import type { Call } from "../../../engine/types";

function isMajorOpening(call: Call): boolean {
  return (
    call.type === "bid" &&
    call.level === 1 &&
    (call.strain === "H" || call.strain === "S")
  );
}

export const bergenTransitionRules: readonly TransitionRule[] = [
  // Detect 1H/1S opening — sets familyId and stores opener's major
  {
    id: "bergen-major-opening",
    matches(state: DialogueState, call: Call) {
      return state.familyId === null && isMajorOpening(call);
    },
    effects(_state: DialogueState, call: Call) {
      const strain = call.type === "bid" ? call.strain : null;
      return {
        setFamilyId: "bergen",
        mergeConventionData: { openerMajor: strain },
      };
    },
  },

  // Bergen responses set agreed strain
  {
    id: "bergen-constructive",
    matches(state: DialogueState, call: Call) {
      return (
        state.familyId === "bergen" &&
        call.type === "bid" &&
        call.level === 3 &&
        call.strain === "C"
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
    matches(state: DialogueState, call: Call) {
      return (
        state.familyId === "bergen" &&
        call.type === "bid" &&
        call.level === 3 &&
        call.strain === "D"
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
