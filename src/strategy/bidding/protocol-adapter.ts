// ── Protocol Adapter ─────────────────────────────────────────────────
//
// Converts a ConventionSpec (protocol frame architecture) into a
// ConventionBiddingStrategy compatible with the existing drill system.
//
// The adapter bridges the new layered replay model to the existing
// meaning pipeline: replay -> surface stack -> runMeaningPipeline.

import type {
  BiddingContext,
  BidResult,
  ConventionBiddingStrategy,
  StrategyEvaluation,
} from "../../core/contracts";
import type { FactCatalog } from "../../core/contracts/fact-catalog";
import type { ConventionSpec } from "../../conventions/core/protocol/types";
import { replay, computeActiveSurfaces } from "../../conventions/core/protocol/replay";
import { createSharedFactCatalog } from "../../conventions/core";
import { createFactCatalog } from "../../core/contracts/fact-catalog";
import { runMeaningPipeline } from "./meaning-strategy";
import { buildBidResult, buildTeachingProjection } from "./bid-result-builder";

/**
 * Convert a ConventionSpec into a ConventionBiddingStrategy.
 *
 * Each call to suggest():
 * 1. Replays the auction through the protocol frame system to get a RuntimeSnapshot
 * 2. Computes active surfaces from the snapshot via surface stack composition
 * 3. Runs the meaning pipeline on the visible surfaces
 * 4. Returns the arbitrated bid result
 */
export function protocolSpecToStrategy(
  spec: ConventionSpec,
): ConventionBiddingStrategy {
  // Build a fact catalog from all module fact extensions
  const moduleFactExtensions = spec.modules
    .map((m) => m.facts)
    .filter((f) => f !== undefined && f !== null);

  const catalog: FactCatalog = moduleFactExtensions.length > 0
    ? createFactCatalog(createSharedFactCatalog(), ...moduleFactExtensions)
    : createSharedFactCatalog();

  let lastEvaluation: StrategyEvaluation | null = {
    practicalRecommendation: null,
    acceptableAlternatives: undefined,
    intentFamilies: undefined,
    provenance: null,
    arbitration: null,
    posteriorSummary: null,
    explanationCatalog: undefined,
    teachingProjection: null,
    facts: null,
    machineSnapshot: null,
  };

  return {
    id: spec.id,
    name: spec.name,
    getLastEvaluation() { return lastEvaluation; },
    suggest(context: BiddingContext): BidResult | null {
      // Step 1: Replay the auction to get the runtime snapshot
      const history = context.auction.entries.map((e) => ({
        call: e.call,
        seat: e.seat,
      }));
      const snapshot = replay(history, spec, context.seat);

      // Step 2: Compute active surfaces from the snapshot
      const composed = computeActiveSurfaces(snapshot, spec);
      if (composed.visibleSurfaces.length === 0) return null;

      // Step 3: Run the meaning pipeline on visible surfaces
      const { result, facts } = runMeaningPipeline({
        surfaces: composed.visibleSurfaces,
        context,
        catalog,
        inheritedDimsLookup: composed.inheritedDimsLookup,
      });

      // Step 4: Build output
      const provenance = result.provenance ?? null;
      const teachingProjection = buildTeachingProjection(result, provenance);

      lastEvaluation = {
        practicalRecommendation: null,
        acceptableAlternatives: undefined,
        intentFamilies: undefined,
        provenance,
        arbitration: result,
        posteriorSummary: null,
        explanationCatalog: undefined,
        teachingProjection,
        facts,
        machineSnapshot: null,
      };

      if (!result.selected) return null;
      const winningModuleId = result.selected.proposal.moduleId;
      return buildBidResult(result.selected, context, winningModuleId, result);
    },
  };
}
