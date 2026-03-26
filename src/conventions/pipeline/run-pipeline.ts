import type { BiddingContext } from "../core/strategy-types";
import type { BidMeaning, ConstraintDimension } from "./evaluation/meaning";
import type { EvaluatedFacts, FactCatalog } from "../core/fact-catalog";
import type { PosteriorFactProvider } from "../../inference/posterior/posterior-types";
import type { PipelineResult } from "./pipeline-types";
import type { RelationalFactContext } from "./facts/fact-evaluator";
import { evaluateFacts } from "./facts/fact-evaluator";
import { evaluateAllBidMeanings } from "./evaluation/meaning-evaluator";
import { arbitrateMeanings, zipProposalsWithSurfaces } from "./evaluation/meaning-arbitrator";
import { getLegalCalls } from "../../engine/auction";
import { partnerSeat } from "../../engine/constants";
import { isVulnerable } from "../../engine/scoring";

// ─── Core Pipeline ─────────────────────────────────────────────
//
// The meaning pipeline is a 4-step pure transformation:
//
//   surfaces → evaluate facts → evaluate meanings → arbitrate
//
// `runPipeline` is the single entry point. Everything before the
// pipeline (surface selection) and after it (result mapping, teaching
// projection) is handled by the caller.

/** Input to the core meaning pipeline. */
interface PipelineInput {
  readonly surfaces: readonly BidMeaning[];
  readonly context: BiddingContext;
  readonly catalog: FactCatalog;
  readonly posteriorProvider?: PosteriorFactProvider;
  /** Relational context for fact evaluation (e.g. publicCommitments from evaluation runtime). */
  readonly relationalContext?: RelationalFactContext;
  /** Maps meaningId → inherited constraint dimensions from prior-round context.
   *  Used by deriveSpecificity() to account for accumulated communicative dimensions. */
  readonly inheritedDimsLookup?: ReadonlyMap<string, readonly ConstraintDimension[]>;
}

/** Output from the core meaning pipeline. */
interface PipelineOutput {
  readonly result: PipelineResult;
  readonly facts: EvaluatedFacts;
}

/**
 * Core meaning pipeline: evaluate facts → evaluate meanings → arbitrate.
 *
 * Pure transformation — no caching, no side effects, no state mutation.
 * Callers handle surface selection (upstream) and result mapping (downstream).
 */
export function runPipeline(input: PipelineInput): PipelineOutput {
  // Step 1: Evaluate facts against the hand
  const vulFlag = input.context.vulnerability !== undefined && input.context.vulnerability !== null
    ? isVulnerable(input.context.seat, input.context.vulnerability)
    : undefined;
  const facts = evaluateFacts(
    input.context.hand, input.context.evaluation,
    input.catalog, {
      relationalContext: input.relationalContext,
      posterior: input.posteriorProvider,
      posteriorSeatId: input.posteriorProvider ? partnerSeat(input.context.seat) : undefined,
      isVulnerable: vulFlag,
    },
  );

  // Step 2: Evaluate each surface's clauses against the facts.
  // Thread fact catalog as a FactCatalogExtension so deriveSpecificity()
  // can resolve constrainsDimensions for module-derived facts.
  const catalogAsExtension = {
    definitions: input.catalog.definitions,
    evaluators: input.catalog.evaluators,
  };
  const proposals = evaluateAllBidMeanings(
    input.surfaces, facts, undefined,
    [catalogAsExtension], input.inheritedDimsLookup,
  );

  // Step 3: Arbitrate — encode, gate-check, rank, and select winner
  const inputs = zipProposalsWithSurfaces(proposals, input.surfaces);
  const legalCalls = getLegalCalls(input.context.auction, input.context.seat);
  const result = arbitrateMeanings(inputs, { legalCalls });

  return { result, facts };
}
