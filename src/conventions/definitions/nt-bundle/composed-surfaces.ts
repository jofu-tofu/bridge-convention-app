// Composed NT surfaces — re-exports individual module surfaces and defines
// cross-module composed surfaces (RESPONDER_SURFACES, STAYMAN_R3_AFTER_2D_SURFACES).
import type { MeaningSurface } from "../../../core/contracts/meaning";
import { staymanModule } from "../modules/stayman";
import { jacobyTransfersModule } from "../modules/jacoby-transfers";
import { naturalNtModule } from "../modules/natural-nt";
import { smolenModule } from "../modules/smolen";
import { STAYMAN_R3_AFTER_2D_SURFACES as STAYMAN_ONLY_R3_2D } from "../modules/stayman";

export { OPENER_STAYMAN_SURFACES, STAYMAN_R3_AFTER_2H_SURFACES, STAYMAN_R3_AFTER_2S_SURFACES, INTERFERENCE_REDOUBLE_SURFACE } from "../modules/stayman";
export { OPENER_TRANSFER_HEARTS_SURFACES, OPENER_TRANSFER_SPADES_SURFACES, TRANSFER_R3_HEARTS_SURFACES, TRANSFER_R3_SPADES_SURFACES, OPENER_PLACE_HEARTS_SURFACES, OPENER_PLACE_SPADES_SURFACES, OPENER_ACCEPT_INVITE_HEARTS_SURFACES, OPENER_ACCEPT_INVITE_SPADES_SURFACES } from "../modules/jacoby-transfers";
export { OPENER_SMOLEN_HEARTS_SURFACES, OPENER_SMOLEN_SPADES_SURFACES } from "../modules/smolen";
export { OPENER_1NT_SURFACE } from "../modules/natural-nt";

// Composed version includes Stayman + Smolen surfaces (backward compat)
const smolenR3Surfaces = smolenModule.surfaceGroups.find(
  (g) => g.groupId === "responder-r3-after-stayman-2d",
)?.surfaces ?? [];
export const STAYMAN_R3_AFTER_2D_SURFACES: readonly MeaningSurface[] = [
  ...STAYMAN_ONLY_R3_2D,
  ...smolenR3Surfaces,
];

// RESPONDER_SURFACES = all modules' entry surfaces concatenated
// (previously assembled by composeNtModules, now inlined)
export const RESPONDER_SURFACES: readonly MeaningSurface[] = [
  ...naturalNtModule.entrySurfaces,
  ...jacobyTransfersModule.entrySurfaces,
  ...staymanModule.entrySurfaces,
  ...smolenModule.entrySurfaces,
];
