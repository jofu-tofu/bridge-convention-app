/**
 * Evidence types for decision program representations.
 *
 * ConditionEvidenceIR is the canonical evidence type for all pipeline
 * provenance and evidence bundles.
 */

/** Evidence for a single condition evaluation. */
export interface ConditionEvidenceIR {
  readonly conditionId: string;
  readonly factId?: string;
  readonly satisfied: boolean;
  readonly observedValue?: unknown;
  readonly threshold?: unknown;
}

/** Evidence for why a meaning was rejected. */
export interface RejectionEvidence {
  readonly meaningId: string;
  readonly failedConditions: readonly ConditionEvidenceIR[];
  readonly moduleId: string;
}

/** Evidence for an alternative meaning that was considered. */
export interface AlternativeEvidence {
  readonly meaningId: string;
  readonly call: string;
  readonly ranking: { readonly band: string; readonly specificity: number };
  readonly reason: string;
}

/** The spec's evidence contract for decision program representations. */
export interface EvidenceBundleIR {
  readonly matched: { meaningId: string; satisfiedConditions: ConditionEvidenceIR[] } | null;
  readonly rejected: readonly RejectionEvidence[];
  readonly alternatives: readonly AlternativeEvidence[];
  readonly exhaustive: boolean;
  readonly fallbackReached: boolean;
}
