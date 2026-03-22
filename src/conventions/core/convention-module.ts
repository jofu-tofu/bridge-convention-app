/**
 * ConventionModule — the unified type for a self-contained convention module.
 *
 * Replaces both the old ConventionModule (surfaces + facts + explanations)
 * and RuleModule (local FSM + rules + facts). One type per module.
 *
 * Declaration fields: facts, explanationEntries
 * Runtime fields: local (FSM), rules (pattern-matched claims)
 *
 * Surfaces are NOT stored directly — use `moduleSurfaces()` to extract
 * deduplicated surfaces from the module's rules.
 *
 * Modules must NOT import from other modules — this is the fundamental
 * decoupling invariant. Pedagogical relations, alternatives, and surface
 * groups are derived automatically from `teachingTags` on surfaces.
 */

import type { BidMeaning } from "../../core/contracts/meaning";
import type { FactCatalogExtension } from "../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../core/contracts/explanation-catalog";
import type { LocalFsm, Rule, Claim } from "./rule-module";

// Re-export for consumer convenience (Claim and LocalFsm are structurally
// part of rule-module.ts but frequently needed alongside ConventionModule).
export type { Claim, LocalFsm } from "./rule-module";

export interface ConventionModule<Phase extends string = string> {
  /** Unique module identifier (kebab-case). */
  readonly moduleId: string;

  // ── Declaration ─────────────────────────────────────────────
  /** Module-derived fact definitions and evaluators. */
  readonly facts: FactCatalogExtension;
  /** Explanation entries for teaching projections. */
  readonly explanationEntries: readonly ExplanationEntry[];

  // ── Runtime ─────────────────────────────────────────────────
  /** Local FSM for phase-based rule scoping. */
  readonly local: LocalFsm<Phase>;
  /** Rules: pattern match conditions → surface claims. */
  readonly rules: readonly Rule<Phase>[];
}

/**
 * Extract deduplicated surfaces from a module's rules.
 * Traverses all rules' claims and deduplicates by meaningId.
 */
export function moduleSurfaces(mod: ConventionModule): readonly BidMeaning[] {
  const seen = new Set<string>();
  const surfaces: BidMeaning[] = [];

  for (const rule of mod.rules) {
    for (const claim of rule.claims) {
      if (!seen.has(claim.surface.meaningId)) {
        seen.add(claim.surface.meaningId);
        surfaces.push(claim.surface);
      }
    }
  }

  return surfaces;
}
