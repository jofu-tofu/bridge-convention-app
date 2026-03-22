// ── Protocol Adapter ─────────────────────────────────────────────────
//
// Converts a ConventionSpec (protocol frame architecture) into a
// ConventionStrategy compatible with the existing drill system.
//
// Rule-only path: all bundles use ruleModules for surface selection
// with per-step kernel threading (Phase 5 complete). Old FSM path removed.

import type {
  BiddingContext,
  BidResult,
  ConventionStrategy,
  StrategyEvaluation,
} from "../../core/contracts";
import type { BidMeaning } from "../../core/contracts/meaning";
import type { FactCatalog } from "../../core/contracts/fact-catalog";
import type { ConventionSpec, RuleModule } from "../../conventions/core";
import { createSharedFactCatalog, createSystemFactCatalog, collectMatchingClaims, collectMatchingClaimsWithPhases, normalizeIntent, advanceLocalFsm } from "../../conventions/core";
import { createFactCatalog } from "../../core/contracts/fact-catalog";
import { SAYC_SYSTEM_CONFIG } from "../../core/contracts/system-config";
import { runMeaningPipeline } from "./meaning-strategy";
import { buildBidResult, buildTeachingProjection } from "./bid-result-builder";
import type { CommittedStep, AuctionContext, NegotiationState, NegotiationDelta } from "../../core/contracts/committed-step";
import { INITIAL_NEGOTIATION } from "../../core/contracts/committed-step";
import type { PublicSnapshot } from "../../core/contracts/module-surface";
import type { Seat, Call } from "../../engine/types";

/**
 * Convert a ConventionSpec into a ConventionStrategy.
 *
 * Each call to suggest():
 * 1. Replays the auction through the protocol frame system to get a RuntimeSnapshot
 * 2. Computes active surfaces from the snapshot (or from rule interpreter if ruleModules present)
 * 3. Runs the meaning pipeline on the visible surfaces
 * 4. Returns the arbitrated bid result
 */
export function protocolSpecToStrategy(
  spec: ConventionSpec,
): ConventionStrategy {
  // Build a fact catalog: shared facts + system-semantic facts + module fact extensions
  const systemFacts = createSystemFactCatalog(spec.systemConfig ?? SAYC_SYSTEM_CONFIG);
  const factExtensions = spec.ruleModules
    .map((m) => m.facts)
    .filter((f) => f !== undefined && f !== null && (f.definitions.length > 0 || f.evaluators.size > 0));

  const catalog: FactCatalog = createFactCatalog(createSharedFactCatalog(), systemFacts, ...factExtensions);

  let lastEvaluation: StrategyEvaluation | null = {
    practicalRecommendation: null,
    acceptableAlternatives: null,
    intentFamilies: null,
    provenance: null,
    arbitration: null,
    posteriorSummary: null,
    explanationCatalog: null,
    teachingProjection: null,
    facts: null,
    machineSnapshot: null,
    auctionContext: null,
  };

  return {
    id: spec.id,
    name: spec.name,
    getLastEvaluation() { return lastEvaluation; },
    suggest(context: BiddingContext): BidResult | null {
      const history = context.auction.entries.map((e) => ({
        call: e.call,
        seat: e.seat,
      }));

      // Rule-only path: per-step replay with real kernel threading.
      if (spec.ruleModules.length === 0) {
        return null;
      }

      const log = buildObservationLogViaRules(history, context.seat, spec.ruleModules);
      const auctionCtx: AuctionContext = { snapshot: {} as PublicSnapshot, log };
      const results = collectMatchingClaims(
        spec.ruleModules,
        auctionCtx,
        context.seat,
      );
      const visibleSurfaces = results.flatMap((r) => r.surfaces);

      if (visibleSurfaces.length === 0) return null;

      // Step 3: Run the meaning pipeline on visible surfaces
      // Extract relational context from surface bindings — all surfaces in a
      // given state share bindings (e.g. { suit: "hearts" }), so take the first.
      const firstBindings = visibleSurfaces.find(s => s.surfaceBindings)?.surfaceBindings;
      const relationalContext = firstBindings
        ? { bindings: firstBindings as Readonly<Record<string, string>> }
        : undefined;

      const { result, facts } = runMeaningPipeline({
        surfaces: visibleSurfaces,
        context,
        catalog,
        relationalContext,
      });

      // Step 4: Build output
      const provenance = result.provenance ?? null;
      const teachingProjection = buildTeachingProjection(result, provenance);

      lastEvaluation = {
        practicalRecommendation: null,
        acceptableAlternatives: null,
        intentFamilies: null,
        provenance,
        arbitration: result,
        posteriorSummary: null,
        explanationCatalog: null,
        teachingProjection,
        facts,
        machineSnapshot: null,
        auctionContext: auctionCtx,
      };

      if (!result.selected) return null;
      const winningModuleId = result.selected.proposal.moduleId;
      return buildBidResult(result.selected, context, winningModuleId, result);
    },
  };
}

// ── Rule-based observation log ────────────────────────────────────────

/** Enriched claim result with kernel delta from the rule module. */
interface EnrichedClaimResult {
  readonly moduleId: string;
  readonly claims: readonly {
    readonly surface: BidMeaning;
    readonly negotiationDelta: NegotiationDelta | undefined;
  }[];
}

/**
 * Build a CommittedStep log by per-step rule replay with real kernel threading.
 *
 * **Replaces the Phase 3 dual-run model.** Instead of using a hardcoded NT
 * observation heuristic (`inferObservationsFromCall()`), this function:
 *   1. For each historical bid, runs claim collection to find candidate surfaces
 *   2. Matches the actual call to a candidate surface via `findMatchingClaimForCall()`
 *   3. Derives observations from `normalizeIntent(surface.sourceIntent)`
 *   4. Threads kernel state via `negotiationDelta` declared on the winning claim
 *
 * **Invariant:** `negotiationDelta` values come from claim declarations, not FSM effects.
 * The values were derived from old FSM `entryEffects` during Phase 4.2, verified
 * via characterization tests.
 *
 * **Performance:** Phase 6 optimization — caches local FSM phases between steps
 * and advances one step at a time instead of full replay. O(N × M) instead of O(N² × M).
 */
export function buildObservationLogViaRules(
  history: readonly { call: Call; seat: Seat }[],
  _observerSeat: Seat,
  ruleModules: readonly RuleModule[],
): readonly CommittedStep[] {
  const log: CommittedStep[] = [];

  // Initialize phase cache from each module's initial phase
  const phaseCache = new Map<string, string>();
  for (const mod of ruleModules) {
    phaseCache.set(mod.id, mod.local.initial);
  }

  for (const entry of history) {
    const prevKernel = log.length > 0 ? log[log.length - 1]!.stateAfter : INITIAL_NEGOTIATION;

    // Passes — raw-only step, kernel unchanged
    // Doubles and redoubles may carry convention meaning (e.g. DONT single-suited
    // double), so they go through claim matching like bids.
    if (entry.call.type === "pass") {
      const step: CommittedStep = {
        actor: entry.seat,
        call: entry.call,
        resolvedClaim: null,
        publicActions: [],
        negotiationDelta: {},
        stateAfter: prevKernel,
        status: "raw-only",
      };
      log.push(step);
      // Advance phases even for raw-only steps (transitions may fire on pass obs)
      advancePhaseCache(phaseCache, step, ruleModules);
      continue;
    }

    // Build context from committed steps so far
    const ctx: AuctionContext = { snapshot: {} as PublicSnapshot, log: [...log] };

    // Find candidate claims with kernel deltas using cached phases
    const enriched = collectClaimsWithDeltasCached(ruleModules, ctx, entry.seat, phaseCache);

    // Match the actual call to a candidate claim
    const matched = findMatchingClaimForCall(enriched, entry.call);

    let step: CommittedStep;
    if (matched) {
      const obs = normalizeIntent(matched.surface.sourceIntent);
      const delta = matched.negotiationDelta ?? {};
      const stateAfter = applyKernelDelta(prevKernel, delta);

      step = {
        actor: entry.seat,
        call: entry.call,
        resolvedClaim: {
          moduleId: matched.moduleId,
          meaningId: matched.surface.meaningId,
          semanticClassId: matched.surface.semanticClassId,
          sourceIntent: matched.surface.sourceIntent,
        },
        publicActions: obs,
        negotiationDelta: delta,
        stateAfter,
        status: "resolved",
      };
    } else {
      // Off-system or unrecognized bid — raw-only, kernel unchanged
      step = {
        actor: entry.seat,
        call: entry.call,
        resolvedClaim: null,
        publicActions: [],
        negotiationDelta: {},
        stateAfter: prevKernel,
        status: "off-system",
      };
    }

    log.push(step);
    // Advance phases for the new step
    advancePhaseCache(phaseCache, step, ruleModules);
  }

  return log;
}

/**
 * Find the claim whose encoding matches a given call.
 *
 * Matching logic:
 * 1. Collect all surfaces whose `encoding.defaultCall` matches (level + strain).
 *    For choice-set encoders, check all calls in the set.
 * 2. If exactly one → return it.
 * 3. If multiple → prefer higher band, then lower modulePrecedence, then lower
 *    intraModuleOrder (same logic as the forward-path arbitration).
 * 4. Return null for unmatched calls.
 */
export function findMatchingClaimForCall(
  results: readonly EnrichedClaimResult[],
  call: Call,
): { surface: BidMeaning; negotiationDelta: NegotiationDelta | undefined; moduleId: string } | null {
  if (call.type === "pass") return null;

  const candidates: {
    surface: BidMeaning;
    negotiationDelta: NegotiationDelta | undefined;
    moduleId: string;
  }[] = [];

  for (const result of results) {
    for (const claim of result.claims) {
      if (callMatchesEncoding(call, claim.surface.encoding)) {
        candidates.push({
          surface: claim.surface,
          negotiationDelta: claim.negotiationDelta,
          moduleId: result.moduleId,
        });
      }
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  // Multiple matches — arbitrate using band → modulePrecedence → intraModuleOrder
  return arbitrateMatchingClaims(candidates);
}

// ── Internal helpers ─────────────────────────────────────────────────

/** Check if a call matches a surface's encoding (defaultCall or alternate encodings). */
function callMatchesEncoding(
  call: Call,
  encoding: BidMeaning["encoding"],
): boolean {
  const dc = encoding.defaultCall;

  // Bid matching (level + strain)
  if (call.type === "bid" && dc.type === "bid" && dc.level === call.level && dc.strain === call.strain) return true;

  // Alternate encoding matching
  if (call.type === "bid" && encoding.alternateEncodings) {
    for (const alt of encoding.alternateEncodings) {
      if (alt.call.type === "bid" && alt.call.level === call.level && alt.call.strain === call.strain) {
        return true;
      }
    }
  }

  // Pass matching
  if (dc.type === "pass" && call.type === "pass") return true;

  // Double matching (e.g. DONT single-suited double)
  if (dc.type === "double" && call.type === "double") return true;

  // Redouble matching
  if (dc.type === "redouble" && call.type === "redouble") return true;

  return false;
}

/** Apply a NegotiationDelta to produce a new NegotiationState. */
function applyKernelDelta(prev: NegotiationState, delta: NegotiationDelta): NegotiationState {
  return {
    fitAgreed: delta.fitAgreed !== undefined ? delta.fitAgreed : prev.fitAgreed,
    forcing: delta.forcing !== undefined ? delta.forcing : prev.forcing,
    captain: delta.captain !== undefined ? delta.captain : prev.captain,
    competition: delta.competition !== undefined ? delta.competition : prev.competition,
  };
}

/** Band priority for arbitration (higher = more preferred). */
const BAND_ORDER: Record<string, number> = {
  must: 3,
  should: 2,
  may: 1,
};

/** Arbitrate among multiple matching claims using the same logic as the forward path. */
function arbitrateMatchingClaims(
  candidates: readonly {
    surface: BidMeaning;
    negotiationDelta: NegotiationDelta | undefined;
    moduleId: string;
  }[],
): { surface: BidMeaning; negotiationDelta: NegotiationDelta | undefined; moduleId: string } {
  // Sort by: band (desc) → modulePrecedence (asc) → intraModuleOrder (asc)
  const sorted = [...candidates].sort((a, b) => {
    const bandA = BAND_ORDER[a.surface.ranking.recommendationBand] ?? 0;
    const bandB = BAND_ORDER[b.surface.ranking.recommendationBand] ?? 0;
    if (bandB !== bandA) return bandB - bandA;

    const precA = a.surface.ranking.modulePrecedence ?? 0;
    const precB = b.surface.ranking.modulePrecedence ?? 0;
    if (precA !== precB) return precA - precB;

    return (a.surface.ranking.intraModuleOrder ?? 0) - (b.surface.ranking.intraModuleOrder ?? 0);
  });

  return sorted[0]!;
}

/**
 * Cached variant — uses pre-computed local phases instead of replaying the FSM.
 * Used by `buildObservationLogViaRules()` for O(N×M) instead of O(N²×M).
 */
function collectClaimsWithDeltasCached(
  modules: readonly RuleModule[],
  context: AuctionContext,
  nextSeat: Seat,
  phaseCache: ReadonlyMap<string, string>,
): readonly EnrichedClaimResult[] {
  const results = collectMatchingClaimsWithPhases(modules, context, nextSeat, phaseCache);
  return enrichResults(results, modules);
}

/** Enrich ModuleClaimResults with negotiationDelta from rule module claims. */
function enrichResults(
  results: readonly { moduleId: string; surfaces: readonly BidMeaning[] }[],
  modules: readonly RuleModule[],
): readonly EnrichedClaimResult[] {
  return results.map((result) => {
    const mod = modules.find((m) => m.id === result.moduleId);
    if (!mod) return { moduleId: result.moduleId, claims: result.surfaces.map((s) => ({ surface: s, negotiationDelta: undefined })) };

    // Build a map from meaningId → negotiationDelta by scanning the module's rules
    const deltaMap = new Map<string, NegotiationDelta | undefined>();
    for (const rule of mod.rules) {
      for (const claim of rule.claims) {
        if (result.surfaces.includes(claim.surface)) {
          deltaMap.set(claim.surface.meaningId, claim.negotiationDelta);
        }
      }
    }

    return {
      moduleId: result.moduleId,
      claims: result.surfaces.map((s) => ({
        surface: s,
        negotiationDelta: deltaMap.get(s.meaningId),
      })),
    };
  });
}

/** Advance the phase cache one step for all modules. */
function advancePhaseCache(
  phaseCache: Map<string, string>,
  step: CommittedStep,
  modules: readonly RuleModule[],
): void {
  for (const mod of modules) {
    const current = phaseCache.get(mod.id) ?? mod.local.initial;
    phaseCache.set(mod.id, advanceLocalFsm(current, step, mod.local.transitions));
  }
}
