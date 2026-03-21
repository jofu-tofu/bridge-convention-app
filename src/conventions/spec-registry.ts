// ── ConventionSpec Registry ──────────────────────────────────────────
//
// Pure data registry for ConventionSpec objects (protocol frame architecture).
// No side effects — safe to import from anywhere without triggering
// legacy registerConvention/registerBundle calls.

import type { ConventionSpec } from "./core/protocol/types";
import { specFromSystem, ntSystem } from "./definitions/system-registry";
import { bergenConventionSpec } from "./definitions/bergen-bundle/convention-spec";
import { weakTwosConventionSpec } from "./definitions/weak-twos-bundle/convention-spec";
import { dontConventionSpec } from "./definitions/dont-bundle/convention-spec";
import { bergenRules } from "./definitions/modules/bergen/bergen-rules";
import { weakTwosRules } from "./definitions/modules/weak-twos/weak-twos-rules";
import { dontRules } from "./definitions/modules/dont/dont-rules";

const ntConventionSpec = specFromSystem(ntSystem)!;

const CONVENTION_SPECS: Map<string, ConventionSpec> = new Map([
  ["nt-bundle", ntConventionSpec],
  ["bergen-bundle", { ...bergenConventionSpec, ruleModules: [bergenRules] }],
  ["weak-twos-bundle", { ...weakTwosConventionSpec, ruleModules: [weakTwosRules] }],
  ["dont-bundle", { ...dontConventionSpec, ruleModules: [dontRules] }],

  // ── Aliases for sub-bundle IDs ──────────────────────────────────────
  // These share the full parent ConventionSpec. The base track includes all
  // modules (Stayman, Jacoby Transfers, Smolen), so atom enumeration returns
  // atoms for all modules — not just the sub-bundle's focus. Deal constraints
  // (from ConventionBundle) handle hand-generation scoping, and the plan
  // command's "uncovered atoms" list reflects atoms outside the sub-bundle's
  // scope. TODO: create dedicated sub-bundle specs with filtered base tracks
  // for precise atom scoping.
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
