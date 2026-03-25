import type { BidMeaningClause } from "./meaning";
import type { FactOperator } from "./meaning";

/**
 * Derive a deterministic clauseId from fact constraint fields.
 *
 * Naming convention:
 * - number:   `"${factId}:${operator}:${value}"` → `"hand.hcp:gte:12"`
 * - boolean:  `"${factId}:boolean:${value}"`     → `"bridge.hasFourCardMajor:boolean:true"`
 * - range:    `"${factId}:range:${min}-${max}"`   → `"hand.hcp:range:10-12"`
 *
 * `$suit` binding references in factId are kept as-is for runtime resolution.
 */
export function deriveClauseId(
  factId: string,
  operator: FactOperator,
  value: number | boolean | string | { min: number; max: number } | readonly string[],
): string {
  if (operator === "range") {
    const range = value as { min: number; max: number };
    return `${factId}:range:${range.min}-${range.max}`;
  }
  if (operator === "in") {
    const arr = value as readonly string[];
    return `${factId}:in:${arr.join(",")}`;
  }
  // At this point value is number | boolean | string (range and in are handled above)
  const scalar = value as number | boolean | string;
  return `${factId}:${operator}:${String(scalar)}`;
}

/** Well-known factId → natural language display name mappings. */
const DISPLAY_NAMES: Record<string, string> = {
  "hand.hcp": "HCP",
  "hand.isBalanced": "balanced",
  "bridge.hasFourCardMajor": "4-card major",
  "bridge.hasFiveCardMajor": "5-card major",
  "bridge.hasShortage": "short suit",
  "bridge.fitWithBoundSuit": "fit with partner's suit",
  "bridge.totalPointsForRaise": "total points",
};

/**
 * Derive a readable display name from a factId.
 *
 * Resolution order:
 * 1. Well-known mapping (e.g., `hand.hcp` → `"HCP"`)
 * 2. Suit extraction for `hand.suitLength.<suit>` → `"<suit>"`
 * 3. Namespace stripping + camelCase expansion for unknown factIds
 */
function displayName(factId: string): string {
  // 1. Well-known mapping
  const known = DISPLAY_NAMES[factId];
  if (known) return known;

  // 2. Extract suit from suitLength path: hand.suitLength.hearts → "hearts"
  const suitLengthMatch = factId.match(/^hand\.suitLength\.(.+)$/);
  if (suitLengthMatch) return suitLengthMatch[1]!;

  // 3. Strip namespace prefix
  let name = factId;
  if (name.startsWith("hand.")) {
    name = name.slice(5);
  } else if (name.startsWith("bridge.")) {
    name = name.slice(7);
  } else if (name.startsWith("module.")) {
    // module.<moduleName>.<factName> — strip first two segments
    const parts = name.split(".");
    name = parts.slice(2).join(".");
  }

  // Convert camelCase to space-separated, handle dots as spaces
  return name
    .replace(/\./g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\$suit/g, "$suit")
    .toLowerCase();
}

/** Whether a display name is adjective-like (can stand alone as "Balanced") vs noun-like (needs "Has a"). */
function isAdjectiveLike(dn: string): boolean {
  const lower = dn.toLowerCase();
  return lower === "balanced" || lower === "eligible";
}

/**
 * Derive a natural-language clause description from fact constraint fields.
 *
 * Description rules:
 * - number + `gte`:     `"${value}+ ${dn}"`          → `"12+ HCP"`, `"5+ hearts"`
 * - number + `lte`:     `"At most ${value} ${dn}"`    → `"At most 3 spades"`
 * - number + `eq`:      `"Exactly ${value} ${dn}"`    → `"Exactly 5 hearts"`
 * - range:              `"${min}–${max} ${dn}"`       → `"10–12 HCP"`
 * - boolean + true:     `"Has a ${dn}"` or `"${Dn}"`  → `"Has a 4-card major"`, `"Balanced"`
 * - boolean + false:    `"No ${dn}"`                  → `"No 5-card major"`
 * - `in`:               `"${dn} in [${values}]"`
 *
 * `$suit` binding references in factId are kept as-is for runtime resolution.
 */
export function deriveClauseDescription(
  factId: string,
  operator: FactOperator,
  value: number | boolean | string | { min: number; max: number } | readonly string[],
): string {
  const dn = displayName(factId);

  switch (operator) {
    case "gte":
      return `${value as number}+ ${dn}`;
    case "lte":
      return `At most ${value as number} ${dn}`;
    case "eq":
      return `Exactly ${String(value as number | boolean | string)} ${dn}`;
    case "range": {
      const range = value as { min: number; max: number };
      return `${range.min}\u2013${range.max} ${dn}`;
    }
    case "boolean":
      if (value === true) {
        return isAdjectiveLike(dn)
          ? dn.charAt(0).toUpperCase() + dn.slice(1)
          : `Has a ${dn}`;
      }
      return `No ${dn}`;
    case "in": {
      const arr = value as readonly string[];
      return `${dn} in [${arr.join(", ")}]`;
    }
  }
}

/**
 * Fill in missing `clauseId` on a BidMeaningClause and ensure `description` is always set.
 * Description is always auto-derived from factId/operator/value, with optional rationale appended.
 * The `description` field is added as a runtime property (not typed on BidMeaningClause) for
 * downstream consumers like the meaning evaluator.
 */
export function fillClauseDefaults(clause: BidMeaningClause): BidMeaningClause & { description: string } {
  const needsId = clause.clauseId === undefined;
  const existing = (clause as BidMeaningClause & { description?: string }).description;

  if (!needsId && existing !== undefined) {
    return clause as BidMeaningClause & { description: string };
  }

  const derived = deriveClauseDescription(clause.factId, clause.operator, clause.value);
  const description = clause.rationale ? `${derived} (${clause.rationale})` : derived;

  return {
    ...clause,
    clauseId: needsId ? deriveClauseId(clause.factId, clause.operator, clause.value) : clause.clauseId,
    ...(existing === undefined ? { description } : {}),
  } as BidMeaningClause & { description: string };
}
