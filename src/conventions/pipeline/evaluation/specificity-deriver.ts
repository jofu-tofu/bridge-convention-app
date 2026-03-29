/**
 * Specificity derivation — the source of truth for surface specificity values.
 *
 * Authored specificity values on BidMeaning.ranking are set to match
 * the output of this deriver. Do not hand-pick specificity numbers.
 *
 * The deriver counts unique communicative constraint dimensions:
 * - Positive clauses contribute their fact's constrainsDimensions
 * - Negative boolean clauses (value: false) are exclusion gates (zero dims
 *   when mixed with positive clauses; shapeClass when sole clause type)
 * - lte on suit length = "no fit" = shapeClass
 * - Vacuous suit length (threshold < 3) = skip
 * - $suit bindings resolve to specific suits (suitLength + suitIdentity)
 * - inheritedDimensions from the surface group add accumulated context
 *
 * No manual tuning. No overrides. The dimension count IS the specificity.
 */

import type { BidMeaning, ConstraintDimension, SpecificityBasis } from "./meaning";
import type { BidMeaningClause } from "./meaning";
import type { FactCatalogExtension, FactDefinition } from "../../core/fact-catalog";
import { classifySpecificityBasis } from "./specificity-classifier";
import { FactOperator } from "./meaning";

/**
 * Full derivation result including advisory specificity, dimension set,
 * transparency basis classification, and (for pairwise comparisons)
 * which linearization canon was applied.
 */
interface SpecificityDerivationResult {
  readonly advisorySpecificity: number;
  readonly dimensions: ReadonlySet<ConstraintDimension>;
  readonly basis: SpecificityBasis;
  /** Which canon was used for linearization, if any. null = pure dimensional count. */
  readonly canonUsed: number | null;
}

// ─── Clause polarity helpers ────────────────────────────────────

/** Minimum suit length threshold to count as communicating meaningful suit info.
 *  Thresholds below this (e.g., "2+ support") are near-vacuous and don't
 *  contribute suitLength/suitIdentity dimensions. */
const MEANINGFUL_SUIT_LENGTH_THRESHOLD = 3;

/**
 * Determine if a clause is a "negative" / exclusion gate rather than
 * a positive informational signal.
 *
 * A clause is negative when:
 * - It's a boolean clause with value: false (e.g., "no 4-card major")
 * - It's an `lte` clause on suit length (upper bound = "at most N cards" = fit denial)
 *
 * How negatives are handled depends on context (see deriveSpecificity):
 * - Boolean(false) as an exclusion gate mixed with positive clauses → contributes nothing
 * - Boolean(false) as the bid's sole meaning → contributes shapeClass
 * - lte on suit length → always contributes shapeClass ("no fit" is shape info)
 */
function isNegativeBooleanClause(clause: BidMeaningClause): boolean {
  return clause.operator === FactOperator.Boolean && clause.value === false;
}

function isSuitLengthUpperBound(clause: BidMeaningClause): boolean {
  return clause.operator === FactOperator.Lte && clause.factId.startsWith("hand.suitLength.");
}

/**
 * Determine if a suit-length clause has a vacuous or near-vacuous threshold.
 * "2+ in a suit" or "3+ in a suit" are so common that they don't meaningfully
 * communicate suit length information to partner.
 */
function isVacuousSuitLength(clause: BidMeaningClause): boolean {
  if (!clause.factId.startsWith("hand.suitLength.")) return false;
  if (clause.operator === FactOperator.Gte && typeof clause.value === "number") {
    return clause.value < MEANINGFUL_SUIT_LENGTH_THRESHOLD;
  }
  return false;
}

// ─── Main derivation ────────────────────────────────────────────

/**
 * Derive an advisory specificity value from a surface's clauses by collecting
 * the union of communicative constraint dimensions across all referenced facts.
 *
 * Key rules:
 * 1. Negative clauses (boolean: false, lte on suit length) contribute only
 *    shapeClass, not the fact's full dimension set.
 * 2. Vacuous suit-length thresholds (< 3 cards) don't count as suitLength
 *    or suitIdentity dimensions.
 * 3. Module-derived facts use their constrainsDimensions annotations, with
 *    negative polarity respected.
 * 4. $suit bindings that resolve to a specific suit contribute suitIdentity.
 */
export function deriveSpecificity(
  surface: BidMeaning,
  factExtensions: readonly FactCatalogExtension[],
  inheritedDimensions?: readonly ConstraintDimension[],
): SpecificityDerivationResult {
  // Build fact lookup from all extensions
  const factLookup = new Map<string, FactDefinition>();
  for (const ext of factExtensions) {
    for (const def of ext.definitions) {
      factLookup.set(def.id, def);
    }
  }

  const dimensions = new Set<ConstraintDimension>();

  // Bindings use key "suit" (not "$suit"); clause factIds use "$suit" as placeholder.
  const suitBindingValue = surface.surfaceBindings !== null && surface.surfaceBindings !== undefined
    ? (surface.surfaceBindings as Record<string, string>)["suit"]
    : undefined;
  const hasSuitBinding = suitBindingValue !== null && suitBindingValue !== undefined;

  // First pass: identify whether the surface has any positive (non-negative) clauses.
  // This determines how boolean(false) clauses are handled.
  const hasPositiveClauses = surface.clauses.some(
    c => !isNegativeBooleanClause(c) && !isSuitLengthUpperBound(c),
  );

  for (const clause of surface.clauses) {
    let factId = clause.factId;

    // Resolve $suit placeholder
    if (hasSuitBinding && factId.includes("$suit")) {
      factId = factId.replace("$suit", suitBindingValue);
    }

    // ── Suit length upper bounds (lte) → always shapeClass ──
    if (isSuitLengthUpperBound(clause)) {
      dimensions.add("shapeClass");
      continue;
    }

    // ── Boolean(false) clauses: context-dependent handling ──
    if (isNegativeBooleanClause(clause)) {
      if (!hasPositiveClauses) {
        // This negative IS the bid's meaning (e.g., "deny major") → shapeClass
        dimensions.add("shapeClass");
      }
      // Otherwise: exclusion gate mixed with positive clauses → contributes nothing
      continue;
    }

    // ── Primitive: hand.hcp ──
    if (factId === "hand.hcp") {
      dimensions.add("pointRange");
      continue;
    }

    // ── Primitive: hand.suitLength.* ──
    if (factId.startsWith("hand.suitLength.")) {
      // Vacuous thresholds (< 3) don't contribute meaningful dimensions
      if (isVacuousSuitLength(clause)) {
        continue;
      }
      dimensions.add("suitLength");
      // Named suit → suitIdentity (whether static or resolved from $suit binding)
      const suffix = factId.slice("hand.suitLength.".length);
      if (suffix && suffix !== "$suit") {
        dimensions.add("suitIdentity");
      }
      continue;
    }

    // ── Primitive: hand.isBalanced ──
    if (factId === "hand.isBalanced") {
      dimensions.add("shapeClass");
      continue;
    }

    // ── Bridge-derived and module facts → use constrainsDimensions ──
    const def = factLookup.get(factId);
    if (def?.constrainsDimensions) {
      for (const dim of def.constrainsDimensions) {
        dimensions.add(dim);
      }
    }
  }

  // ── Inherited dimensions from prior-round context ──
  // When a surface group declares inheritedDimensions (dimensions accumulated
  // from prior-round bids), union them into this surface's dimension set so
  // the derived specificity reflects the full communicative context.
  if (inheritedDimensions) {
    for (const dim of inheritedDimensions) {
      dimensions.add(dim);
    }
  }

  // Classify basis transparency
  const basis = classifySpecificityBasis(surface, factExtensions);

  return {
    advisorySpecificity: dimensions.size,
    dimensions,
    basis,
    canonUsed: null,
  };
}
