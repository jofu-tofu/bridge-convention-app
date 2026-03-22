/**
 * DONT (Disturbing Opponents' Notrump) convention module.
 *
 * Self-contained module exporting a ConventionModule object.
 * FSM states and transitions are defined in the RuleModule (dont-rules.ts).
 */

import type { SystemConfig } from "../../../../core/contracts/system-config";
import type { FactCatalogExtension } from "../../../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../../../core/contracts/explanation-catalog";
import { dontFacts } from "./facts";
import { DONT_ENTRIES } from "./explanation-catalog";

/** Module parts returned by createDontModule (declaration-only — no local/rules). */
export interface DontModuleParts {
  readonly facts: FactCatalogExtension;
  readonly explanationEntries: readonly ExplanationEntry[];
}

/**
 * Create DONT module declaration parts for the given system config.
 *
 * Returns facts and explanations only. Full ConventionModule assembly
 * (adding local FSM + rules) happens in module-registry.ts.
 */
export function createDontModule(_sys: SystemConfig): DontModuleParts {
  return {
    facts: dontFacts,
    explanationEntries: DONT_ENTRIES,
  };
}
