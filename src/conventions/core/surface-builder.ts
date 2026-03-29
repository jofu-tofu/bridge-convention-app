import {
  Disclosure,
  type BidMeaning,
  type BidMeaningClause,
  type RecommendationBand,
} from "../pipeline/evaluation/meaning";
import type { Call } from "../../engine/types";
import type { TeachingLabel } from "./authored-text";
import { deriveClauseId, deriveClauseDescription } from "../pipeline/evaluation/clause-derivation";

export { Disclosure } from "../pipeline/evaluation/meaning";

/**
 * Simplified clause input for the surface builder.
 * `clauseId` and `description` are always auto-derived from factId/operator/value.
 * Provide `rationale` to append author context in parentheses (e.g., "fit with opener").
 */
export interface SimplifiedClause {
  readonly factId: string;
  readonly operator: BidMeaningClause["operator"];
  readonly value: number | boolean | { min: number; max: number };
  readonly isPublic?: boolean;
  /** Author-provided rationale appended in parentheses to the auto-derived description.
   *  Use only for context beyond the mechanical constraint (e.g., "fit with opener"). */
  readonly rationale?: string;
}

/**
 * Input for `createSurface()`. All required fields for a BidMeaning
 * except those derivable from ModuleContext or clause data.
 */
export interface SurfaceInput {
  readonly meaningId: string;
  readonly semanticClassId: string;
  readonly encoding: Call | {
    readonly defaultCall: Call;
    readonly alternateEncodings?: readonly { call: Call; condition?: string }[];
  };
  readonly clauses: readonly SimplifiedClause[];
  readonly band: RecommendationBand;
  readonly declarationOrder: number;
  readonly sourceIntent: {
    readonly type: string;
    readonly params: Readonly<Record<string, string | number | boolean>>;
  };
  /** How this bid's meaning is disclosed to opponents at the table. */
  readonly disclosure: Disclosure;
  readonly teachingLabel: TeachingLabel;
  // Optional overrides:
  readonly moduleId?: string;
  readonly surfaceBindings?: Readonly<Record<string, string>>;

}

/**
 * Module-level defaults injected into surfaces created within that module.
 * `moduleId` is set on every surface unless explicitly overridden on SurfaceInput.
 * `modulePrecedence` is NOT authored here — it's assigned positionally by the
 * composition layer (composeModules) based on module ordering in the bundle.
 */
export interface ModuleContext {
  readonly moduleId: string;
}

/**
 * Build a complete BidMeaning from simplified input.
 *
 * - Normalizes `encoding` (wraps bare Call in `{ defaultCall }`)
 * - Fills `moduleId` from `ctx` when not on input
 * - `modulePrecedence` defaults to 0; the composition layer stamps it
 *   positionally via `precedenceOverride`
 * - Derives `clauseId` and `description` at build time via `deriveClauseId()`
 *   and `deriveClauseDescription()`. Optional `rationale` on SimplifiedClause
 *   is appended in parentheses to the auto-derived description.
 * - Returns a complete BidMeaning with all fields populated
 *
 * @param precedenceOverride Used only by composeModules() to stamp positional precedence.
 * @throws Error if moduleId is absent from both input and context
 */
export function createSurface(input: SurfaceInput, ctx?: ModuleContext, precedenceOverride?: number): BidMeaning {
  const moduleId = input.moduleId ?? ctx?.moduleId;
  if (moduleId === undefined) {
    throw new Error(
      `createSurface: moduleId required for surface "${input.meaningId}" — provide it on SurfaceInput or via ModuleContext`,
    );
  }

  const modulePrecedence = precedenceOverride ?? 0;

  // Normalize encoding: wrap bare Call in { defaultCall }
  const encoding: BidMeaning["encoding"] =
    "defaultCall" in input.encoding
      ? input.encoding
      : { defaultCall: input.encoding };

  // Build clauses with derived clauseId and description (always auto-derived + optional rationale).
  // Binding placeholders (e.g., $suit) in descriptions are resolved here at build time
  // so all downstream consumers get clean display text without coupling to binding logic.
  const bindings = input.surfaceBindings;
  const clauses: readonly BidMeaningClause[] = input.clauses.map((c) => {
    let description = deriveClauseDescription(c.factId, c.operator, c.value, c.rationale);
    if (bindings) {
      description = description.replace(/\$(\w+)/g, (match, key: string) => bindings[key] ?? match);
    }
    return {
      factId: c.factId,
      operator: c.operator,
      value: c.value,
      clauseId: deriveClauseId(c.factId, c.operator, c.value),
      description,
      ...(c.rationale !== undefined ? { rationale: c.rationale } : {}),
      ...(c.isPublic !== undefined ? { isPublic: c.isPublic } : {}),
    };
  });

  const surface: BidMeaning = {
    meaningId: input.meaningId,
    semanticClassId: input.semanticClassId,
    moduleId,
    encoding,
    clauses,
    ranking: {
      recommendationBand: input.band,
      modulePrecedence,
      declarationOrder: input.declarationOrder,
    },
    sourceIntent: input.sourceIntent,
    disclosure: input.disclosure,
    teachingLabel: input.teachingLabel,
    ...(input.surfaceBindings ? { surfaceBindings: input.surfaceBindings } : {}),
  };

  return surface;
}
