/**
 * Evidence types for decision program representations.
 *
 * ConditionEvidenceIR is the canonical evidence type for all pipeline
 * provenance and evidence bundles.
 */

/** Role a condition plays in the evaluation pipeline. */
export type ConditionRole = "semantic" | "inferential" | "pedagogical" | "routing";

/** Evidence for a single condition evaluation. */
export interface ConditionEvidenceIR {
  readonly conditionId: string;
  readonly factId?: string;
  /** Parameters for parameterized facts (e.g. `{ suit: "hearts" }` for `suitLength(hearts)`). */
  readonly params?: Readonly<Record<string, unknown>>;
  readonly satisfied: boolean;
  readonly observedValue?: unknown;
  readonly threshold?: unknown;
}

/** Evidence for why a meaning was rejected. */
export interface RejectionEvidence {
  readonly meaningId: string;
  readonly failedConditions: readonly ConditionEvidenceIR[];
  readonly moduleId: string;
  /** Conditions whose failure supports negative inference (invertInference). Optional for backward compat. */
  readonly negatableFailures?: readonly ConditionEvidenceIR[];
}

/** Evidence for an alternative meaning that was considered. */
export interface AlternativeEvidence {
  readonly meaningId: string;
  readonly call: string;
  readonly ranking: { readonly band: string; readonly specificity: number };
  readonly reason: string;
  /** Per-condition delta vs. matched meaning (spec: Agreement Module IR). Optional for backward compat. */
  readonly conditionDelta?: readonly ConditionEvidenceIR[];
}

/** The spec's evidence contract for decision program representations. */
export interface EvidenceBundleIR {
  readonly matched: { meaningId: string; satisfiedConditions: ConditionEvidenceIR[] } | null;
  readonly rejected: readonly RejectionEvidence[];
  readonly alternatives: readonly AlternativeEvidence[];
  readonly exhaustive: boolean;
  readonly fallbackReached: boolean;
}
