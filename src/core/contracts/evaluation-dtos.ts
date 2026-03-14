/**
 * Re-export from tree-evaluation.ts — the canonical source for evaluation DTOs.
 * This file exists for backward compatibility with existing imports.
 * New code should import from "./tree-evaluation" or from the barrel "../contracts".
 */
export {
  type SiblingConditionDetail,
  type CandidateEligibility,
  type ResolvedCandidateDTO,
  isDtoSelectable,
  isDtoPedagogicallyAcceptable,
  type AlternativeGroup,
  type IntentRelationship,
  type IntentFamily,
  type EvaluationTrace,
} from "./tree-evaluation";
