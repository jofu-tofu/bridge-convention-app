/**
 * Bergen Raises convention module.
 *
 * Self-contained module exporting a ConventionModule object.
 */

import type { SystemConfig } from "../../../../core/contracts/system-config";
import type { FactCatalogExtension } from "../../../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../../../core/contracts/explanation-catalog";
import { bergenFacts } from "./facts";
import { BERGEN_EXPLANATION_ENTRIES } from "./explanation-catalog";

/** Module parts returned by createBergenModule (declaration-only — no local/rules). */
export interface BergenModuleParts {
  readonly facts: FactCatalogExtension;
  readonly explanationEntries: readonly ExplanationEntry[];
}

/**
 * Create Bergen module declaration parts for the given system config.
 *
 * Returns facts and explanations only. Full ConventionModule assembly
 * (adding local FSM + rules) happens in module-registry.ts.
 */
export function createBergenModule(_sys: SystemConfig): BergenModuleParts {
  return {
    facts: bergenFacts,
    explanationEntries: BERGEN_EXPLANATION_ENTRIES,
  };
}
