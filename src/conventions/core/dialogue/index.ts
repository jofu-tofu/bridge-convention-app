// Barrel exports for the dialogue state system.

export {
  ForcingState,
  PendingAction,
  CompetitionMode,
  CaptainRole,
  SystemMode,
  getSystemModeFor,
} from "./dialogue-state";
export type { DialogueState, AgreedStrain, InterferenceDetail } from "./dialogue-state";

export type { DialogueEffect, TransitionRule } from "./dialogue-transitions";
export { applyEffect, applyBackfillEffect, getEffectKeys } from "./dialogue-transitions";

export { computeDialogueState, INITIAL_DIALOGUE_STATE } from "./dialogue-manager";
export { baselineTransitionRules } from "./baseline-transitions";
export { areSamePartnership, partnerOfOpener, isOpenerSeat } from "./helpers";

export type { ClassifiedEntry } from "./event-classifier";
export { classifyAuctionEntry } from "./event-classifier";
