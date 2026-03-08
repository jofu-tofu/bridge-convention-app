// Barrel exports for the dialogue state system.

export {
  ForcingState,
  ObligationKind,
  CompetitionMode,
  CaptainRole,
  SystemMode,
  getSystemModeFor,
} from "./dialogue-state";
export type { DialogueState, AgreedStrain, InterferenceDetail, Obligation } from "./dialogue-state";

export type { DialogueEffect, TransitionRule, TransitionRuleDescriptor } from "./dialogue-transitions";
export { applyEffect, applyBackfillEffect, getEffectKeys, obligationFromFrame } from "./dialogue-transitions";

export { computeDialogueState, INITIAL_DIALOGUE_STATE } from "./dialogue-manager";
export { baselineTransitionRules } from "./baseline-transitions";
export { areSamePartnership, partnerOfOpener, isOpenerSeat } from "./helpers";

export type { ClassifiedEntry } from "./event-classifier";
export { classifyAuctionEntry } from "./event-classifier";
