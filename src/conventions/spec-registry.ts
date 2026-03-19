// ── ConventionSpec Registry ──────────────────────────────────────────
//
// Pure data registry for ConventionSpec objects (protocol frame architecture).
// No side effects — safe to import from anywhere without triggering
// legacy registerConvention/registerBundle calls.

import type { ConventionSpec } from "./core/protocol/types";
import { ntConventionSpec } from "./definitions/nt-bundle/convention-spec";
import { bergenConventionSpec } from "./definitions/bergen-bundle/convention-spec";
import { weakTwosConventionSpec } from "./definitions/weak-twos-bundle/convention-spec";
import { dontConventionSpec } from "./definitions/dont-bundle/convention-spec";

const CONVENTION_SPECS: Map<string, ConventionSpec> = new Map([
  ["nt-bundle", ntConventionSpec],
  ["bergen-bundle", bergenConventionSpec],
  ["weak-twos-bundle", weakTwosConventionSpec],
  ["dont-bundle", dontConventionSpec],

  // ── Aliases for legacy sub-bundle / mismatched IDs ──────────────────
  // The legacy registry exposes these IDs via registerConvention/registerBundle,
  // but they share the same protocol-frame spec as their parent bundle.
  // Deal constraints (from ConventionBundle) handle hand-generation scoping.
  ["nt-stayman", ntConventionSpec],
  ["nt-transfers", ntConventionSpec],
  ["weak-two-bundle", weakTwosConventionSpec], // legacy bundle ID (missing trailing "s")
]);

export function getConventionSpec(id: string): ConventionSpec | undefined {
  return CONVENTION_SPECS.get(id);
}

export function listConventionSpecs(): ConventionSpec[] {
  // Deduplicate: the same spec object may appear under multiple alias keys.
  return [...new Set(CONVENTION_SPECS.values())];
}
