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
]);

export function getConventionSpec(id: string): ConventionSpec | undefined {
  return CONVENTION_SPECS.get(id);
}

export function listConventionSpecs(): ConventionSpec[] {
  return Array.from(CONVENTION_SPECS.values());
}
