/**
 * Evidence types for decision program representations.
 *
 * ConditionResult is the shared base for all "did a condition pass?"
 * shapes across evidence, teaching, and pipeline types.
 *
 * ConditionEvidence extends it as the canonical evidence type for
 * pipeline provenance and evidence bundles.
 */

/** Role a condition plays in the evaluation pipeline. */
export type ConditionRole = "semantic" | "inferential" | "pedagogical" | "routing";

/** Base condition evaluation result — shared across evidence, teaching, and pipeline types. */
export interface ConditionResult {
  readonly conditionId?: string;
  readonly factId?: string;
  readonly satisfied: boolean;
  readonly description?: string;
  readonly observedValue?: unknown;
  readonly threshold?: unknown;
  readonly conditionRole?: ConditionRole;
}

/** Evidence for a single condition evaluation. */
export interface ConditionEvidence extends ConditionResult {
  readonly conditionId: string;
  /** Parameters for parameterized facts (e.g. `{ suit: "hearts" }` for `suitLength(hearts)`). */
  readonly params?: Readonly<Record<string, unknown>>;
}

/** Evidence for why a meaning was rejected. */
export interface RejectionEvidence {
  readonly meaningId: string;
  readonly failedConditions: readonly ConditionEvidence[];
  readonly moduleId: string;
  /** Conditions whose failure supports negative inference (invertInference). Optional for backward compat. */
  readonly negatableFailures?: readonly ConditionEvidence[];
}

/** Evidence for an alternative meaning that was considered. */
export interface AlternativeEvidence {
  readonly meaningId: string;
  readonly call: string;
  readonly ranking: { readonly band: string; readonly specificity: number };
  readonly reason: string;
  /** Per-condition delta vs. matched meaning (spec: Agreement Module IR). Optional for backward compat. */
  readonly conditionDelta?: readonly ConditionEvidence[];
}

/** The spec's evidence contract for decision program representations. */
export interface EvidenceBundle {
  readonly matched: { meaningId: string; satisfiedConditions: ConditionEvidence[] } | null;
  readonly rejected: readonly RejectionEvidence[];
  readonly alternatives: readonly AlternativeEvidence[];
  readonly exhaustive: boolean;
  readonly fallbackReached: boolean;
}
