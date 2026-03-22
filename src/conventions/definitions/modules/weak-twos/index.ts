/**
 * Weak Twos convention module.
 *
 * Self-contained module exporting a ConventionModule object.
 * FSM states and transitions are defined in the RuleModule (weak-twos-rules.ts).
 */

import type { SystemConfig } from "../../../../core/contracts/system-config";
import type { FactCatalogExtension } from "../../../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../../../core/contracts/explanation-catalog";
import { weakTwoFacts } from "./facts";
import { WEAK_TWO_ENTRIES } from "./explanation-catalog";

/** Module parts returned by createWeakTwosModule (declaration-only — no local/rules). */
export interface WeakTwosModuleParts {
  readonly facts: FactCatalogExtension;
  readonly explanationEntries: readonly ExplanationEntry[];
}

/**
 * Create Weak Twos module declaration parts for the given system config.
 *
 * Returns facts and explanations only. Full ConventionModule assembly
 * (adding local FSM + rules) happens in module-registry.ts.
 */
export function createWeakTwosModule(_sys: SystemConfig): WeakTwosModuleParts {
  return {
    facts: weakTwoFacts,
    explanationEntries: WEAK_TWO_ENTRIES,
  };
}
