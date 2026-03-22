import type { Call, NumberRange } from "../../engine/types";
import type { ConditionEvidence } from "./evidence-bundle";
import type { EncoderKind } from "./provenance";

/** Pedagogical relation between two bids or meanings.
 *  Used by teaching UI to explain "why is X better than Y?" */
export type TeachingRelation =
  | { readonly kind: "same-family"; readonly a: string; readonly b: string }
  | { readonly kind: "stronger-than"; readonly a: string; readonly b: string }
  | { readonly kind: "weaker-than"; readonly a: string; readonly b: string }
  | { readonly kind: "fallback-of"; readonly a: string; readonly b: string }
  | { readonly kind: "continuation-of"; readonly a: string; readonly b: string }
  | { readonly kind: "near-miss-of"; readonly a: string; readonly b: string };

/** Teaching-optimized view of a bid decision.
 *  This is the sole projection of ArbitrationResult metadata into the feedback
 *  pipeline — consumers (BidFeedbackDTO, BidFeedbackLike, TeachingDetail) read
 *  arbitration-derived data from here, never from ArbitrationResult directly. */
export interface TeachingProjection {
  readonly callViews: readonly CallProjection[];
  readonly meaningViews: readonly MeaningView[];
  readonly primaryExplanation: readonly ExplanationNode[];
  readonly whyNot: readonly WhyNotEntry[];
  readonly conventionsApplied: readonly ConventionContribution[];
  readonly handSpace: HandSpaceSummary;
  /** Post-bid parse tree showing the full decision chain:
   *  which conventions were considered, why each was accepted/rejected,
   *  and the path to the correct bid. */
  readonly parseTree?: ParseTreeView;
  /** Whether the evidence bundle reported exhaustive evaluation. */
  readonly evaluationExhaustive: boolean;
  /** Whether the fallback was reached (no convention surface matched). */
  readonly fallbackReached: boolean;
  /** Encoder kind from the encoding provenance trace (when available). */
  readonly encoderKind?: EncoderKind;
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
  readonly supportingEvidence: readonly ConditionEvidence[];
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
  readonly familyRelation?: TeachingRelation;
  readonly explanation: readonly ExplanationNode[];
  readonly eliminationStage: string;
}

/** Pedagogical relation kind values (derived from TeachingRelation). */
export type TeachingRelationKind = TeachingRelation["kind"];

/** How a convention contributed to the decision. */
export interface ConventionContribution {
  readonly moduleId: string;
  readonly role: "primary" | "alternative" | "suppressed";
  readonly meaningsProposed: readonly string[];
}

/** Compact description of a class of hands consistent with constraints. */
interface HandArchetypeSummary {
  readonly label: string;
  readonly hcpRange: NumberRange;
  readonly shapePattern: string;
  readonly frequency?: number;
}

/** A representative example hand from the consistent space. */
interface ExampleHand {
  readonly description: string;
  readonly hcp: number;
}

/** Seat-relative hand space summary for teaching context. */
export interface HandSpaceSummary {
  readonly seatLabel: string;
  readonly hcpRange: NumberRange;
  readonly shapeDescription: string;
  readonly partnerSummary?: string;
  readonly archetypes?: readonly HandArchetypeSummary[];
  readonly witnessHands?: readonly ExampleHand[];
}

// ── Parse Tree ──────────────────────────────────────────────────────
//
// A structured decision-chain view showing how the system arrived at
// the correct bid.  Presented post-bid so users see the full
// "recognition → execution" path without cueing effects.

/** Verdict for a single convention module in the parse tree. */
export type ParseTreeModuleVerdict = "selected" | "applicable" | "eliminated";

/** One condition evaluated for a convention module. */
export interface ParseTreeCondition {
  readonly factId: string;
  readonly description: string;
  readonly satisfied: boolean;
  readonly observedValue?: unknown;
}

/** A convention module node in the parse tree. */
export interface ParseTreeModuleNode {
  readonly moduleId: string;
  readonly displayLabel: string;
  readonly verdict: ParseTreeModuleVerdict;
  /** Key conditions that determined this module's verdict. */
  readonly conditions: readonly ParseTreeCondition[];
  /** Meanings this module proposed (with pass/fail status). */
  readonly meanings: readonly {
    readonly meaningId: string;
    readonly displayLabel: string;
    readonly matched: boolean;
    readonly call?: Call;
  }[];
  /** Why this module was eliminated (when verdict is "eliminated"). */
  readonly eliminationReason?: string;
}

/** The full parse-tree view of a bid decision.
 *  Structured as: hand facts → convention modules → selected bid. */
export interface ParseTreeView {
  /** Convention modules that were evaluated, ordered: selected first,
   *  then other applicable, then eliminated. */
  readonly modules: readonly ParseTreeModuleNode[];
  /** The winning module + meaning path (null when fallback reached). */
  readonly selectedPath: {
    readonly moduleId: string;
    readonly meaningId: string;
    readonly call: Call;
  } | null;
}
