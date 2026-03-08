// Weak Twos dialogue transition rules.
// Composed with baseline rules in config:
//   transitionRules: [...weakTwoTransitionRules, ...baselineTransitionRules]

import type { TransitionRule } from "../../core/dialogue/dialogue-transitions";
import { PendingAction } from "../../core/dialogue/dialogue-state";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { partnerOfOpener } from "../../core/dialogue/helpers";

function isWeakTwoOpening(call: Call): boolean {
  return (
    call.type === "bid" &&
    call.level === 2 &&
    (call.strain === BidSuit.Hearts || call.strain === BidSuit.Spades || call.strain === BidSuit.Diamonds)
  );
}

function is2NT(call: Call): boolean {
  return call.type === "bid" && call.level === 2 && call.strain === BidSuit.NoTrump;
}

export const weakTwoTransitionRules: readonly TransitionRule[] = [
  // Detect weak two opening — sets familyId, stores opening suit and openerSeat
  {
    id: "weak-two-opening",
    matches(state: DialogueState, entry) {
      const { call } = entry;
      return state.familyId === null && isWeakTwoOpening(call);
    },
    effects(_state: DialogueState, entry) {
      const { call, seat } = entry;
      const strain = call.type === "bid" ? call.strain : null;
      return {
        setFamilyId: "weak-two",
        mergeConventionData: { openingSuit: strain, openerSeat: seat },
      };
    },
  },

  // Ogust 2NT ask after weak two — sets pending action (partner of opener only)
  {
    id: "weak-two-ogust-ask",
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return state.familyId === "weak-two" && is2NT(call) && partnerOfOpener(state, seat);
    },
    effects() {
      return {
        setPendingAction: PendingAction.ShowSuit,
      };
    },
  },
];
