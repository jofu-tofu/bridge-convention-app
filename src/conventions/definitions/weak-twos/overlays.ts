// Weak Twos interference handling is implemented via ProtocolBranch on the
// "response" round (see tree.ts). Overlay patches remain available for
// fine-grained hooks (suppressIntent, addIntents, overrideResolver) that
// branches don't cover.

import type { ConventionOverlayPatch } from "../../core/overlay/overlay";

export const weakTwoOverlays: readonly ConventionOverlayPatch[] = [];
