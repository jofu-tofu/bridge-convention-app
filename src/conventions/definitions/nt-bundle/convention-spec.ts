/**
 * ConventionSpec assembly for the 1NT bundle.
 *
 * Composes the 1NT base track and its surface fragments into a
 * fully assembled ConventionSpec — the primary export for the
 * new protocol frame architecture.
 */

import { assembleConventionSpec } from "../../core/protocol/spec-assembler";
import { ntBaseTrack, NT_SURFACE_FRAGMENTS } from "./base-track";

export const ntConventionSpec = assembleConventionSpec({
  id: "nt-bundle",
  name: "1NT Opening",
  modules: [
    {
      module: { ...ntBaseTrack, role: "base" as const },
      surfaces: NT_SURFACE_FRAGMENTS,
    },
  ],
});
