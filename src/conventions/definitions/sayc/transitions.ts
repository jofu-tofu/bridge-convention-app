// SAYC dialogue transition rules.
// SAYC is a full bidding system, not a single convention. The transition
// rules detect the opening type and set familyId accordingly.
// Composed with baseline rules in config:
//   transitionRules: [...saycTransitionRules, ...baselineTransitionRules]

import type { TransitionRule } from "../../core/dialogue/dialogue-transitions";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import type { Call } from "../../../engine/types";

export const saycTransitionRules: readonly TransitionRule[] = [
  // Detect 1NT opening
  {
    id: "sayc-1nt-opening",
    matches(state: DialogueState, call: Call) {
      return (
        state.familyId === null &&
        call.type === "bid" &&
        call.level === 1 &&
        call.strain === "NT"
      );
    },
    effects() {
      return { setFamilyId: "sayc-1nt" };
    },
  },
  // Detect suit opening at 1-level
  {
    id: "sayc-suit-opening",
    matches(state: DialogueState, call: Call) {
      return (
        state.familyId === null &&
        call.type === "bid" &&
        call.level === 1 &&
        call.strain !== "NT"
      );
    },
    effects(_state: DialogueState, call: Call) {
      const strain = call.type === "bid" ? call.strain : null;
      return { setFamilyId: "sayc-suit", mergeConventionData: { openingSuit: strain } };
    },
  },
  // Detect 2C strong opening
  {
    id: "sayc-2c-opening",
    matches(state: DialogueState, call: Call) {
      return (
        state.familyId === null &&
        call.type === "bid" &&
        call.level === 2 &&
        call.strain === "C"
      );
    },
    effects() {
      return { setFamilyId: "sayc-2c" };
    },
  },
];
