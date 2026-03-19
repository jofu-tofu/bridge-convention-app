/**
 * ConventionSpec assembly for the Bergen Raises bundle.
 *
 * Composes the Bergen base track and its surface fragments into a
 * fully assembled ConventionSpec — the primary export for the
 * new protocol frame architecture.
 */

import { assembleConventionSpec } from "../../core/protocol/spec-assembler";
import { BERGEN_BASE_TRACK, BERGEN_SURFACE_FRAGMENTS } from "./base-track";

export const bergenConventionSpec = assembleConventionSpec({
  id: "bergen-bundle",
  name: "Bergen Raises",
  modules: [
    {
      module: { ...BERGEN_BASE_TRACK, role: "base" as const },
      surfaces: BERGEN_SURFACE_FRAGMENTS,
    },
  ],
});
