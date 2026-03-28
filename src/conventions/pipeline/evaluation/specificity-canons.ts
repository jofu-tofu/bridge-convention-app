import type { ConstraintDimension } from "./meaning";

/**
 * Linearization canons for resolving specificity between incomparable surfaces.
 *
 * When two surfaces have equal dimension counts but constrain different dimensions,
 * the partial order cannot determine which is more specific. These canons provide
 * a deterministic, published, auditable set of tiebreaking rules.
 *
 * Canon numbering is stable — new canons are appended, existing canons are never
 * renumbered. This allows `specificityBasis: "conventional:canon-N"` references
 * to remain valid across versions.
 */

/** Canon 1: Dimensional Count
 *  More constrained dimensions = higher specificity.
 *  This is the primary canon — it handles the ~75-80% of pairs where
 *  dimension counts differ. */
export const CANON_DIMENSIONAL_COUNT = 1;

/** Canon 2: Dimension Priority Order
 *  When dimension counts are equal, compare dimension sets using this
 *  priority order. A surface constraining a higher-priority dimension
 *  wins over one constraining a lower-priority dimension.
 *
 *  Rationale: suitRelation > shapeClass because relational constraints
 *  are more informative (they describe how suits relate to each other).
 *  pointRange > suitIdentity because HCP range is more discriminating
 *  than suit naming in typical bridge contexts. */
const DIMENSION_PRIORITY: readonly ConstraintDimension[] = [
  "suitRelation",   // Most informative: describes suit relationships
  "shapeClass",     // Distributional shape (two-suited, balanced, shortage)
  "pointRange",     // HCP/point bounds
  "suitIdentity",   // Which specific suit(s)
  "suitLength",     // Card count in suits (least discriminating alone)
];
export const CANON_DIMENSION_PRIORITY = 2;

// Canons 3 (Convention Depth) and 4 (Named Suit Override) are context-dependent
// and not resolved in this module. They exist in the design but are not yet implemented.

/**
 * Compare two dimension sets using the linearization canons.
 * Returns negative if setA should rank higher (more specific),
 * positive if setB should rank higher, 0 if canons cannot distinguish.
 *
 * This function does NOT replace compareRanking(). It is used by the
 * advisory derivation system to explain WHY a particular specificity
 * value was assigned.
 */
export function compareByCanons(
  setA: ReadonlySet<ConstraintDimension>,
  setB: ReadonlySet<ConstraintDimension>,
): { result: number; canonUsed: number | null } {
  // Canon 1: Dimensional count
  const countDiff = setB.size - setA.size;
  if (countDiff !== 0) {
    return { result: countDiff > 0 ? 1 : -1, canonUsed: CANON_DIMENSIONAL_COUNT };
  }

  // Canon 2: Dimension priority — compare by highest-priority dimension present in one but not the other
  for (const dim of DIMENSION_PRIORITY) {
    const inA = setA.has(dim);
    const inB = setB.has(dim);
    if (inA && !inB) return { result: -1, canonUsed: CANON_DIMENSION_PRIORITY };
    if (!inA && inB) return { result: 1, canonUsed: CANON_DIMENSION_PRIORITY };
  }

  // Canons 3-4 are context-dependent and cannot be resolved here.
  // Return 0 to indicate canons cannot distinguish.
  return { result: 0, canonUsed: null };
}
