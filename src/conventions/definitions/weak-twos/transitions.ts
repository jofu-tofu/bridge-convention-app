// Weak Twos dialogue transition rules.
// Composed with baseline rules in config:
//   transitionRules: [...weakTwoTransitionRules, ...baselineTransitionRules]

import type { TransitionRule } from "../../core/dialogue/dialogue-transitions";
import { PendingAction } from "../../core/dialogue/dialogue-state";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import type { Call } from "../../../engine/types";

function isWeakTwoOpening(call: Call): boolean {
  return (
    call.type === "bid" &&
    call.level === 2 &&
    (call.strain === "H" || call.strain === "S" || call.strain === "D")
  );
}

function is2NT(call: Call): boolean {
  return call.type === "bid" && call.level === 2 && call.strain === "NT";
}

export const weakTwoTransitionRules: readonly TransitionRule[] = [
  // Detect weak two opening — sets familyId and stores opening suit
  {
    id: "weak-two-opening",
    matches(state: DialogueState, call: Call) {
      return state.familyId === null && isWeakTwoOpening(call);
    },
    effects(_state: DialogueState, call: Call) {
      const strain = call.type === "bid" ? call.strain : null;
      return {
        setFamilyId: "weak-two",
        mergeConventionData: { openingSuit: strain },
      };
    },
  },

  // Ogust 2NT ask after weak two — sets pending action
  {
    id: "weak-two-ogust-ask",
    matches(state: DialogueState, call: Call) {
      return state.familyId === "weak-two" && is2NT(call);
    },
    effects() {
      return {
        setPendingAction: PendingAction.ShowSuit,
      };
    },
  },
];
