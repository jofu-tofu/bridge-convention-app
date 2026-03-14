import type { Call } from "../../engine/types";
import type { ConditionEvidenceIR } from "./evidence-bundle";

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
  readonly familyRelation?: PedagogicalRelationEntry;
  readonly explanation: readonly ExplanationNode[];
  readonly eliminationStage: string;
}

/** Inline pedagogical relation for WhyNotEntry (avoids circular import). */
export interface PedagogicalRelationEntry {
  readonly kind: PedagogicalRelationKind;
  readonly a: string;
  readonly b: string;
}

/** Pedagogical relation kind values (shared with pedagogical-relations.ts). */
export type PedagogicalRelationKind =
  | "same-family"
  | "stronger-than"
  | "weaker-than"
  | "fallback-of"
  | "continuation-of"
  | "near-miss-of";

/** How a convention contributed to the decision. */
export interface ConventionContribution {
  readonly moduleId: string;
  readonly role: "primary" | "alternative" | "suppressed";
  readonly meaningsProposed: readonly string[];
  readonly transformsApplied: readonly string[];
}

/** Compact description of a class of hands consistent with constraints. */
export interface HandArchetypeSummary {
  readonly label: string;
  readonly hcpRange: { readonly min: number; readonly max: number };
  readonly shapePattern: string;
  readonly frequency?: number;
}

/** A representative example hand from the consistent space. */
export interface WitnessHand {
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
