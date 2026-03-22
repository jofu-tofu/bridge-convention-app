/**
 * ConventionModule — the formal contract for a self-contained convention module.
 *
 * A module is an independent unit of bidding logic. It owns its surfaces, facts,
 * and teaching metadata. Modules must NOT import from other modules —
 * this is the fundamental decoupling invariant.
 *
 * Pedagogical relations, alternatives, and intent families are derived automatically
 * from `teachingTags` on surfaces by the derivation function. Modules do not
 * declare these explicitly.
 *
 * Bundles (bidding systems) compose modules via system profiles. Cross-module
 * wiring (hook transitions, composed surfaces) belongs exclusively at the
 * system/bundle level.
 */

import type { BidMeaning } from "../../core/contracts/meaning";
import type { FactCatalogExtension } from "../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../core/contracts/explanation-catalog";

export interface ConventionModule {
  /** Unique module identifier (kebab-case). */
  readonly moduleId: string;

  /** All surfaces for this module (flat list; grouping derived from RuleModule rules). */
  readonly surfaces: readonly BidMeaning[];

  /** Module-derived fact definitions and evaluators. */
  readonly facts: FactCatalogExtension;

  /** Explanation entries for teaching projections. */
  readonly explanationEntries: readonly ExplanationEntry[];
}
