// ── facts/ barrel ──────────────────────────────────────────────────────
// Fact evaluation: hand → facts (primitive, bridge-derived, module-derived).

export { evaluateFacts } from "./fact-evaluator";
export type { RelationalFactContext, EvaluateFactsOptions } from "./fact-evaluator";
export { createSharedFactCatalog, SHARED_EVALUATORS } from "./shared-fact-catalog";
export { createSystemFactCatalog } from "./system-fact-catalog";
export { createHandFactResolver } from "./hand-fact-resolver";
export { defineBooleanFact, definePerSuitFacts, defineHcpRangeFact, buildExtension } from "./fact-factory";
export type { FactEntry } from "./fact-factory";
export { num, bool, fv } from "./fact-helpers";
export type { HandFactResolverFn } from "./fact-helpers";
export { topologicalSort } from "./fact-utils";
export { invertComposition } from "./fact-inversion";
export type { InvertedConstraint } from "./fact-inversion";
