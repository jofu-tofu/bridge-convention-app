import type { BidMeaningClause } from "./meaning";
import { FactOperator } from "./meaning";

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
  if (operator === FactOperator.Range) {
    const range = value as { min: number; max: number };
    return `${factId}:range:${range.min}-${range.max}`;
  }
  if (operator === FactOperator.In) {
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
  } else if (name.startsWith("system.")) {
    // system.<role>.<concept> — strip first two segments (like module.*)
    const parts = name.split(".");
    name = parts.slice(2).join(".");
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

/** Append rationale in parentheses to a base description. */
function withRationale(base: string, rationale?: string): string {
  return rationale ? `${base} (${rationale})` : base;
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
 * When `rationale` is provided, it is appended in parentheses:
 *   `"12+ HCP (for Stayman)"`
 *
 * `$suit` binding references in factId are kept as-is for runtime resolution.
 */
export function deriveClauseDescription(
  factId: string,
  operator: FactOperator,
  value: number | boolean | string | { min: number; max: number } | readonly string[],
  rationale?: string,
): string {
  const dn = displayName(factId);
  let base: string;

  switch (operator) {
    case FactOperator.Gte:
      base = `${value as number}+ ${dn}`; break;
    case FactOperator.Lte:
      base = `At most ${value as number} ${dn}`; break;
    case FactOperator.Eq:
      base = `Exactly ${String(value as number | boolean | string)} ${dn}`; break;
    case FactOperator.Range: {
      const range = value as { min: number; max: number };
      base = `${range.min}\u2013${range.max} ${dn}`; break;
    }
    case FactOperator.Boolean:
      base = (value === true)
        ? (isAdjectiveLike(dn) ? dn.charAt(0).toUpperCase() + dn.slice(1) : `Has a ${dn}`)
        : `No ${dn}`;
      break;
    case FactOperator.In: {
      const arr = value as readonly string[];
      base = `${dn} in [${arr.join(", ")}]`; break;
    }
  }

  return withRationale(base, rationale);
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

  const description = deriveClauseDescription(clause.factId, clause.operator, clause.value, clause.rationale);

  return {
    ...clause,
    clauseId: needsId ? deriveClauseId(clause.factId, clause.operator, clause.value) : clause.clauseId,
    ...(existing === undefined ? { description } : {}),
  } as BidMeaningClause & { description: string };
}

/**
 * Derive a value-free, system-neutral description from a factId.
 * Uses the same display name resolution as `deriveClauseDescription` but omits
 * concrete threshold values. Suitable for teaching contexts where the specific
 * value varies by system and should not be hard-coded.
 *
 * Examples:
 * - `("hand.hcp", "for Stayman")`              → `"HCP (for Stayman)"`
 * - `("system.responder.inviteValues", "invite values opposite 1NT")`
 *                                                → `"Invite values opposite 1NT"`
 * - `("hand.suitLength.hearts")`                → `"Hearts"`
 */
export function deriveNeutralDescription(factId: string, rationale?: string): string {
  const dn = displayName(factId);
  const capitalized = dn.charAt(0).toUpperCase() + dn.slice(1);

  // For system facts, rationale is typically richer context — use it as the
  // full description to avoid redundancy (e.g., "invite values (invite values)")
  if (factId.startsWith("system.") && rationale) {
    return rationale.charAt(0).toUpperCase() + rationale.slice(1);
  }

  return withRationale(capitalized, rationale);
}
