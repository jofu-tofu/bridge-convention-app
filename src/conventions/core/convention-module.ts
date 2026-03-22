/**
 * ConventionModule — the unified type for a self-contained convention module.
 *
 * Declaration fields: facts, explanationEntries
 * Runtime fields: local (FSM), states (StateEntry-based surface selection)
 *
 * Surfaces are NOT stored directly — use `moduleSurfaces()` to extract
 * deduplicated surfaces from the module's states.
 *
 * Modules must NOT import from other modules — this is the fundamental
 * decoupling invariant. Pedagogical relations, alternatives, and surface
 * groups are derived automatically from `teachingTags` on surfaces.
 */

import type { BidMeaning } from "../../core/contracts/meaning";
import type { FactCatalogExtension } from "../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../core/contracts/explanation-catalog";
import type { LocalFsm, StateEntry } from "./rule-module";

// Re-export for consumer convenience (Claim, LocalFsm, and StateEntry are structurally
// part of rule-module.ts but frequently needed alongside ConventionModule).
export type { Claim, LocalFsm, StateEntry } from "./rule-module";

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
  /** State entries: surfaces grouped by conversation state. */
  readonly states?: readonly StateEntry<Phase>[];
}

/**
 * Extract deduplicated surfaces from a module's states.
 * Iterates `state.surfaces` and deduplicates by meaningId.
 */
export function moduleSurfaces(mod: ConventionModule): readonly BidMeaning[] {
  const seen = new Set<string>();
  const surfaces: BidMeaning[] = [];

  for (const entry of (mod.states ?? [])) {
    for (const surface of entry.surfaces) {
      if (!seen.has(surface.meaningId)) {
        seen.add(surface.meaningId);
        surfaces.push(surface);
      }
    }
  }

  return surfaces;
}
