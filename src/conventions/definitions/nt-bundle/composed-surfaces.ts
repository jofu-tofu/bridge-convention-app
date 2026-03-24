// Composed NT surfaces — re-exports individual module surfaces and defines
// cross-module composed surfaces (createStaymanR3After2DSurfaces).
import type { BidMeaning } from "../../pipeline/meaning";
import type { SystemConfig } from "../system-config";
import { createSmolenR3Surfaces } from "../modules/smolen";
import { createStaymanR3After2DSurfaces as createStaymanOnlyR3_2D } from "../modules/stayman";

export { OPENER_STAYMAN_SURFACES, createStaymanR3After2HSurfaces, createStaymanR3After2SSurfaces } from "../modules/stayman";
export { OPENER_TRANSFER_HEARTS_SURFACES, OPENER_TRANSFER_SPADES_SURFACES, OPENER_PLACE_HEARTS_SURFACES, OPENER_PLACE_SPADES_SURFACES } from "../modules/jacoby-transfers";
export { OPENER_SMOLEN_HEARTS_SURFACES, OPENER_SMOLEN_SPADES_SURFACES } from "../modules/smolen";

// Composed version includes Stayman + Smolen surfaces (backward compat)
export function createComposedR3After2DSurfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
    ...createStaymanOnlyR3_2D(sys),
    ...createSmolenR3Surfaces(sys),
  ];
}


