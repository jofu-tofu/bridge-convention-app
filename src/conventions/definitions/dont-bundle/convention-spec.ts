/**
 * ConventionSpec assembly for the DONT bundle.
 *
 * Composes the DONT base track and its surface fragments into a
 * fully assembled ConventionSpec — the primary export for the
 * new protocol frame architecture.
 */

import { assembleConventionSpec } from "../../core/protocol/spec-assembler";
import { DONT_BASE_TRACK, DONT_SURFACE_FRAGMENTS } from "./base-track";

export const dontConventionSpec = assembleConventionSpec({
  id: "dont-bundle",
  name: "DONT (Disturb Opponents' No Trump)",
  modules: [
    {
      module: { ...DONT_BASE_TRACK, role: "base" as const },
      surfaces: DONT_SURFACE_FRAGMENTS,
    },
  ],
});
