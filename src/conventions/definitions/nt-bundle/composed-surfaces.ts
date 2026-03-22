// Composed NT surfaces — re-exports individual module surfaces and defines
// cross-module composed surfaces (STAYMAN_R3_AFTER_2D_SURFACES).
import type { BidMeaning } from "../../../core/contracts/meaning";
import { SMOLEN_R3_SURFACES } from "../modules/smolen";
import { STAYMAN_R3_AFTER_2D_SURFACES as STAYMAN_ONLY_R3_2D } from "../modules/stayman";

export { OPENER_STAYMAN_SURFACES, STAYMAN_R3_AFTER_2H_SURFACES, STAYMAN_R3_AFTER_2S_SURFACES } from "../modules/stayman";
export { OPENER_TRANSFER_HEARTS_SURFACES, OPENER_TRANSFER_SPADES_SURFACES, TRANSFER_R3_HEARTS_SURFACES, TRANSFER_R3_SPADES_SURFACES, OPENER_PLACE_HEARTS_SURFACES, OPENER_PLACE_SPADES_SURFACES, OPENER_ACCEPT_INVITE_HEARTS_SURFACES, OPENER_ACCEPT_INVITE_SPADES_SURFACES } from "../modules/jacoby-transfers";
export { OPENER_SMOLEN_HEARTS_SURFACES, OPENER_SMOLEN_SPADES_SURFACES } from "../modules/smolen";

// Composed version includes Stayman + Smolen surfaces (backward compat)
export const STAYMAN_R3_AFTER_2D_SURFACES: readonly BidMeaning[] = [
  ...STAYMAN_ONLY_R3_2D,
  ...SMOLEN_R3_SURFACES,
];


