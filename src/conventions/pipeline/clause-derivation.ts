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

/**
 * Strip common fact namespace prefixes for readable display names.
 *
 * Prefix stripping rules:
 * - `hand.`             → removed (e.g., `hand.hcp` → `hcp`)
 * - `bridge.`           → removed (e.g., `bridge.hasFourCardMajor` → `hasFourCardMajor`)
 * - `module.<name>.`    → removed (e.g., `module.stayman.eligible` → `eligible`)
 *
 * The result is then converted from camelCase to readable form:
 * - `hasFourCardMajor` → `has four card major`
 * - `hcp` → `HCP` (special case)
 * - `suitLength` → `suit length`
 */
function displayName(factId: string): string {
  // Strip namespace prefix
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

  // Special cases
  if (name === "hcp") return "HCP";
  if (name === "isBalanced") return "balanced";

  // Convert camelCase to space-separated, handle dots as spaces
  return name
    .replace(/\./g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\$suit/g, "$suit")
    .toLowerCase();
}

/**
 * Derive a readable clause description from fact constraint fields.
 *
 * Description rules:
 * - number + `gte`:     `"${displayName} >= ${value}"`  → `"HCP >= 12"`
 * - number + `lte`:     `"${displayName} <= ${value}"`  → `"HCP <= 6"`
 * - number + `eq`:      `"${displayName} = ${value}"`
 * - range:              `"${displayName} ${min}-${max}"` → `"HCP 10-12"`
 * - boolean + true:     `"${displayName}"`              → `"has four card major"`
 * - boolean + false:    `"no ${displayName}"`           → `"no five card major"`
 * - `in`:               `"${displayName} in [${values}]"`
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
      return `${dn} >= ${value as number}`;
    case "lte":
      return `${dn} <= ${value as number}`;
    case "eq":
      return `${dn} = ${String(value as number | boolean | string)}`;
    case "range": {
      const range = value as { min: number; max: number };
      return `${dn} ${range.min}-${range.max}`;
    }
    case "boolean":
      return value === true ? dn : `no ${dn}`;
    case "in": {
      const arr = value as readonly string[];
      return `${dn} in [${arr.join(", ")}]`;
    }
  }
}

/**
 * Fill in missing `clauseId` and `description` on a BidMeaningClause.
 * Returns the clause unchanged if both fields are already present.
 */
export function fillClauseDefaults(clause: BidMeaningClause): BidMeaningClause {
  const needsId = clause.clauseId === undefined;
  const needsDesc = clause.description === undefined;

  if (!needsId && !needsDesc) return clause;

  return {
    ...clause,
    clauseId: needsId ? deriveClauseId(clause.factId, clause.operator, clause.value) : clause.clauseId,
    description: needsDesc ? deriveClauseDescription(clause.factId, clause.operator, clause.value) : clause.description,
  };
}
