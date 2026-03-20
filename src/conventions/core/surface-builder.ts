import type {
  MeaningSurface,
  MeaningSurfaceClause,
  RecommendationBand,
} from "../../core/contracts/meaning";
import type { Call } from "../../engine/types";
import type { ChoiceClosurePolicy } from "../../core/contracts/agreement-module";
import type { PedagogicalTagRef } from "../../core/contracts/pedagogical-tag";
import { deriveClauseId, deriveClauseDescription } from "./pipeline/clause-derivation";

/**
 * Simplified clause input for the surface builder.
 * `clauseId` and `description` are auto-derived from factId/operator/value.
 * Provide `description` explicitly only when adding convention-specific
 * rationale (e.g., parenthetical context like "(transfer instead)").
 */
export interface SimplifiedClause {
  readonly factId: string;
  readonly operator: MeaningSurfaceClause["operator"];
  readonly value: number | boolean | { min: number; max: number };
  readonly isPublic?: boolean;
  /** Override auto-derived description. Use only when adding parenthetical
   *  rationale beyond the mechanical constraint. */
  readonly description?: string;
}

/**
 * Input for `createSurface()`. All required fields for a MeaningSurface
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
  readonly intraModuleOrder: number;
  readonly sourceIntent: {
    readonly type: string;
    readonly params: Readonly<Record<string, string | number | boolean>>;
  };
  readonly teachingLabel: string;
  // Optional overrides:
  readonly moduleId?: string;
  readonly closurePolicy?: ChoiceClosurePolicy;
  readonly surfaceBindings?: Readonly<Record<string, string>>;
  readonly pedagogicalTags?: readonly PedagogicalTagRef[];
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
 * Build a complete MeaningSurface from simplified input.
 *
 * - Normalizes `encoding` (wraps bare Call in `{ defaultCall }`)
 * - Fills `moduleId` from `ctx` when not on input
 * - `modulePrecedence` defaults to 0; the composition layer stamps it
 *   positionally via `precedenceOverride`
 * - Derives `clauseId` and `description` at build time via `deriveClauseId()`
 *   and `deriveClauseDescription()`. Explicit `description` on SimplifiedClause
 *   takes precedence over auto-derived values.
 * - Returns a complete MeaningSurface with all fields populated
 *
 * @param precedenceOverride Used only by composeModules() to stamp positional precedence.
 * @throws Error if moduleId is absent from both input and context
 */
export function createSurface(input: SurfaceInput, ctx?: ModuleContext, precedenceOverride?: number): MeaningSurface {
  const moduleId = input.moduleId ?? ctx?.moduleId;
  if (moduleId === undefined) {
    throw new Error(
      `createSurface: moduleId required for surface "${input.meaningId}" — provide it on SurfaceInput or via ModuleContext`,
    );
  }

  const modulePrecedence = precedenceOverride ?? 0;

  // Normalize encoding: wrap bare Call in { defaultCall }
  const encoding: MeaningSurface["encoding"] =
    "defaultCall" in input.encoding
      ? input.encoding
      : { defaultCall: input.encoding };

  // Build clauses with derived clauseId and description
  const clauses: readonly MeaningSurfaceClause[] = input.clauses.map((c) => ({
    factId: c.factId,
    operator: c.operator,
    value: c.value,
    clauseId: deriveClauseId(c.factId, c.operator, c.value),
    description: c.description ?? deriveClauseDescription(c.factId, c.operator, c.value),
    ...(c.isPublic !== undefined ? { isPublic: c.isPublic } : {}),
  }));

  const surface: MeaningSurface = {
    meaningId: input.meaningId,
    semanticClassId: input.semanticClassId,
    moduleId,
    encoding,
    clauses,
    ranking: {
      recommendationBand: input.band,
      modulePrecedence,
      intraModuleOrder: input.intraModuleOrder,
    },
    sourceIntent: input.sourceIntent,
    teachingLabel: input.teachingLabel,
    ...(input.closurePolicy ? { closurePolicy: input.closurePolicy } : {}),
    ...(input.surfaceBindings ? { surfaceBindings: input.surfaceBindings } : {}),
    ...(input.pedagogicalTags ? { pedagogicalTags: input.pedagogicalTags } : {}),
  };

  return surface;
}
