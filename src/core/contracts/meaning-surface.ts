import type { Call } from "../../engine/types";
import type { MeaningId, SemanticClassId, RankingMetadata } from "./meaning";
import type { PublicConsequences } from "./agreement-module";

export interface MeaningSurfaceClause {
  readonly clauseId: string;
  readonly factId: string;
  readonly operator: "gte" | "lte" | "eq" | "range" | "boolean" | "in";
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
  readonly semanticClassId?: SemanticClassId;
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
  readonly sourceIntent: {
    readonly type: string;
    readonly params: Readonly<Record<string, string | number | boolean>>;
  };
  readonly teachingLabel?: string;
  readonly familyId?: string;
  readonly publicConsequences?: PublicConsequences;
  readonly surfaceBindings?: Readonly<Record<string, string>>;
}
