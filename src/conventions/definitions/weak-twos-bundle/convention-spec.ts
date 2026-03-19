/**
 * ConventionSpec assembly for the Weak Two Bids bundle.
 *
 * Composes the Weak Two base track and its surface fragments into a
 * fully assembled ConventionSpec — the primary export for the
 * new protocol frame architecture.
 */

import { assembleConventionSpec } from "../../core/protocol/spec-assembler";
import { WEAK_TWO_BASE_TRACK, WEAK_TWO_SURFACE_FRAGMENTS } from "./base-track";

export const weakTwosConventionSpec = assembleConventionSpec({
  id: "weak-twos-bundle",
  name: "Weak Two Bids",
  modules: [
    {
      module: { ...WEAK_TWO_BASE_TRACK, role: "base" as const },
      surfaces: WEAK_TWO_SURFACE_FRAGMENTS,
    },
  ],
});
