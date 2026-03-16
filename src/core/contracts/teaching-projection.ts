import type { Call } from "../../engine/types";
import type { ConditionEvidenceIR } from "./evidence-bundle";
import type { PedagogicalRelation } from "./pedagogical-relations";

/** Teaching-optimized view of a bid decision. */
export interface TeachingProjection {
  readonly callViews: readonly CallProjection[];
  readonly meaningViews: readonly MeaningView[];
  readonly primaryExplanation: readonly ExplanationNode[];
  readonly whyNot: readonly WhyNotEntry[];
  readonly conventionsApplied: readonly ConventionContribution[];
  readonly handSpace: SeatRelativeHandSpaceSummary;
}

/** How a specific call appears in the teaching view. */
export interface CallProjection {
  readonly call: Call;
  readonly status: "truth" | "acceptable" | "wrong";
  readonly supportingMeanings: readonly string[];
  readonly primaryMeaning?: string;
  readonly projectionKind: "single-rationale" | "merged-equivalent" | "multi-rationale-same-call";
}

/** A meaning's status in the teaching view. */
export interface MeaningView {
  readonly meaningId: string;
  readonly semanticClassId?: string;
  readonly displayLabel: string;
  readonly status: "live" | "eliminated" | "not-applicable";
  readonly eliminationReason?: string;
  readonly supportingEvidence: readonly ConditionEvidenceIR[];
}

/** Explanation node for structured teaching text. */
export interface ExplanationNode {
  readonly kind: "text" | "condition" | "call-reference" | "convention-reference";
  readonly content: string;
  readonly passed?: boolean;
  /** Stable explanation ID from the catalog, when matched. */
  readonly explanationId?: string;
  /** i18n-ready template key from the catalog, when matched. */
  readonly templateKey?: string;
}

/** "Why not this call?" entry for eliminated alternatives. */
export interface WhyNotEntry {
  readonly call: Call;
  readonly grade: "near-miss" | "wrong";
  readonly familyRelation?: PedagogicalRelation;
  readonly explanation: readonly ExplanationNode[];
  readonly eliminationStage: string;
}

/** Pedagogical relation kind values (derived from PedagogicalRelation). */
export type PedagogicalRelationKind = PedagogicalRelation["kind"];

/** How a convention contributed to the decision. */
export interface ConventionContribution {
  readonly moduleId: string;
  readonly role: "primary" | "alternative" | "suppressed";
  readonly meaningsProposed: readonly string[];
  readonly transformsApplied: readonly string[];
}

/** Compact description of a class of hands consistent with constraints. */
interface HandArchetypeSummary {
  readonly label: string;
  readonly hcpRange: { readonly min: number; readonly max: number };
  readonly shapePattern: string;
  readonly frequency?: number;
}

/** A representative example hand from the consistent space. */
interface WitnessHand {
  readonly description: string;
  readonly hcp: number;
}

/** Seat-relative hand space summary for teaching context. */
export interface SeatRelativeHandSpaceSummary {
  readonly seatLabel: string;
  readonly hcpRange: { readonly min: number; readonly max: number };
  readonly shapeDescription: string;
  readonly partnerSummary?: string;
  readonly archetypes?: readonly HandArchetypeSummary[];
  readonly witnessHands?: readonly WitnessHand[];
}
