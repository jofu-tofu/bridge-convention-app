import type { Call } from "../../engine/types";
import type { MeaningId, SemanticClassId, RankingMetadata } from "./meaning";
import type { PublicConsequences, PriorityClassId } from "./agreement-module";

/** Operator for fact-based clause evaluation. */
export type FactOperator = "gte" | "lte" | "eq" | "range" | "boolean" | "in";

export interface MeaningSurfaceClause {
  readonly clauseId: string;
  readonly factId: string;
  readonly operator: FactOperator;
  readonly value:
    | number
    | boolean
    | string
    | { min: number; max: number }
    | readonly string[];
  readonly description: string;
}

export interface MeaningSurface {
  readonly meaningId: MeaningId;
  readonly semanticClassId: SemanticClassId;
  readonly moduleId: string;
  readonly encoding: {
    readonly defaultCall: Call;
    readonly alternateEncodings?: readonly {
      call: Call;
      condition?: string;
    }[];
  };
  readonly clauses: readonly MeaningSurfaceClause[];
  readonly ranking: RankingMetadata;
  /** Author-declared semantic priority class.
   *  When set, the SystemProfile's `priorityClassMapping` resolves this to a
   *  `RecommendationBand` at runtime, overriding `ranking.recommendationBand`.
   *  Optional for backward compatibility — surfaces without this field use the
   *  band from `ranking` directly. */
  readonly priorityClass?: PriorityClassId;
  readonly sourceIntent: {
    readonly type: string;
    readonly params: Readonly<Record<string, string | number | boolean>>;
  };
  readonly teachingLabel: string;
  readonly publicConsequences?: PublicConsequences;
  /** Bridge alert status — when set, partner alerts or announces this bid at the table.
   *  When absent, resolveAlert() derives from priorityClass and sourceIntent.
   *  The formal explanation comes from publicConsequences (same FactConstraintIR vocabulary). */
  readonly alert?: "alert" | "announce";
  readonly surfaceBindings?: Readonly<Record<string, string>>;
}
