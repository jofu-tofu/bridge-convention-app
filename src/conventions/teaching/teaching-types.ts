import type { Call, NumberRange } from "../../engine/types";
import type { ConditionEvidence } from "../pipeline/evidence-bundle";
import type { EncoderKind } from "../pipeline/provenance";

// ── Teaching Grading Types ──────────────────────────────────────────────

/** Discriminator for how members within a family are related. */
export type SurfaceGroupRelationship =
  | "mutually_exclusive"    // Only one applies per hand (e.g., game vs limit raise)
  | "equivalent_encoding"   // Same meaning, different call (e.g., relay paths)
  | "policy_alternative";   // Both valid, convention policy prefers one

/** Declares that multiple meaning leaves belong to the same conceptual family.
 *  Members reference meaningIds (bidName). Convention-level grouping for
 *  diagnostics, teaching, and relationship-aware grading. */
export interface SurfaceGroup {
  readonly id: string;
  readonly label: string;
  readonly members: readonly string[];
  readonly relationship: SurfaceGroupRelationship;
  readonly description: string;
}

export enum BidGrade {
  Correct = "correct",
  CorrectNotPreferred = "correct-not-preferred",
  Acceptable = "acceptable",
  NearMiss = "near-miss",
  Incorrect = "incorrect",
}

export interface AcceptableBid {
  readonly call: Call;
  readonly bidName: string;
  readonly meaning: string;
  readonly reason: string;
  readonly fullCredit: boolean;
  readonly tier: "preferred" | "alternative";
  /** Intent family relationship, if the bid belongs to an SurfaceGroup. */
  readonly relationship?: SurfaceGroupRelationship;
  /** Originating module — threaded from ResolvedCandidateDTO. */
  readonly moduleId?: string;
}

export interface TeachingResolution {
  readonly primaryBid: Call;
  readonly acceptableBids: readonly AcceptableBid[];
  readonly gradingType: "exact" | "primary_plus_acceptable" | "intent_based";
  readonly ambiguityScore: number;
  /** All calls in the truth set (correct bids that aren't the primary recommendation).
   *  When populated, matching a truth-set call yields CorrectNotPreferred instead of Incorrect. */
  readonly truthSetCalls?: readonly Call[];
  /** Calls that are in the same surface group as a correct answer but fail a constraint.
   *  When populated, matching a near-miss call yields NearMiss instead of Incorrect. */
  readonly nearMissCalls?: readonly { call: Call; reason: string }[];
}

// ── Teaching Projection Types ───────────────────────────────────────────

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
  readonly explanation: readonly ExplanationNode[];
  readonly eliminationStage: string;
}

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
