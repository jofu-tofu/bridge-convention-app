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
 * decoupling invariant. Surface groups are derived automatically from
 * module state structure (each state entry with 2+ surfaces).
 */

import type { BidMeaning } from "../pipeline/evaluation/meaning";
import type { FactCatalogExtension } from "./fact-catalog";
import type { ExplanationEntry } from "./explanation-catalog";
import type { LocalFsm, StateEntry } from "./rule-module";

// Re-export for consumer convenience (ResolvedSurface, LocalFsm, and StateEntry are structurally
// part of rule-module.ts but frequently needed alongside ConventionModule).
export type { ResolvedSurface, LocalFsm, StateEntry } from "./rule-module";

/** Teaching content orthogonal to module structure.
 *  Entry transitions express "when to use." Surface clauses express constraints.
 *  Teaching adds strategic insight the structure can't express.
 *  Must be self-contained — no references to other modules (scales to 100+). */
export interface ModuleTeaching {
  /** What you give up by playing this convention — strategic tradeoff.
   *  E.g., "Using 2C as Stayman means you can't play in a 2C contract." */
  readonly tradeoff?: string;
  /** The broader bridge principle this module embodies.
   *  E.g., "Transfer principle: let the strong hand be declarer to protect
   *  tenaces from the opening lead." */
  readonly principle?: string;
  /** Common mistakes or misconceptions — things the structure can't warn about.
   *  E.g., "Don't use Stayman with 4-3-3-3 shape — prefer a quantitative raise." */
  readonly commonMistakes?: readonly string[];
}

export interface ConventionModule<Phase extends string = string> {
  /** Unique module identifier (kebab-case). */
  readonly moduleId: string;
  /** Human-readable one-line description of what this module does. */
  readonly description: string;
  /** Why this module exists — the problem it solves for the partnership. */
  readonly purpose: string;
  /** Strategic teaching content orthogonal to structure (tradeoffs, principles, mistakes). */
  readonly teaching?: ModuleTeaching;

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
