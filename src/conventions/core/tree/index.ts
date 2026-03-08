// Tree subsystem barrel — rule tree evaluation.

export { decision, handDecision, fallback, validateTree } from "./rule-tree";
export type {
  DecisionNode,
  FallbackNode,
  RuleNode,
  HandNode,
  HandDecisionNode,
  IntentNode,
  TreeConventionConfig,
  DecisionMetadata,
  BidMetadata,
  ConventionExplanations,
  BidAlert,
} from "./rule-tree";

export { evaluateTree } from "./tree-evaluator";
export type { TreeEvalResult, PathEntry } from "./tree-evaluator";

export { findSiblingBids, findCandidateBids } from "./sibling-finder";
