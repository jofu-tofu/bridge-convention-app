import type { Call } from "../../engine/types";
import type { MeaningId, SemanticClassId, RankingMetadata } from "./meaning";
import type {
  PriorityClassId,
  ChoiceClosurePolicy,
  FactConstraintIR,
} from "./agreement-module";

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
  /** When true, this clause is included in the alert's public constraints.
   *  Primitive hand facts (hand.*) are always public regardless of this flag.
   *  Use this for bridge-derived or module facts the bundle wants to disclose. */
  readonly isPublic?: boolean;
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
  /** Bridge alert status — when set, partner alerts or announces this bid at the table.
   *  When absent, resolveAlert() derives from priorityClass and sourceIntent.
   *  Public constraints are auto-derived from primitive/bridge-observable clauses. */
  readonly alert?: "alert" | "announce";
  /** Closure policy for entailed denials — known only to your partnership.
   *  When a surface in a closed domain is chosen, unchosen peers' derived
   *  public constraints become entailed denials for partnership posterior. */
  readonly closurePolicy?: ChoiceClosurePolicy;
  /** Explicit denials — constraints this bid actively communicates as NOT true.
   *  e.g., deny-major explicitly denies hasFourCardMajor. */
  readonly denies?: readonly FactConstraintIR[];
  readonly surfaceBindings?: Readonly<Record<string, string>>;
}
