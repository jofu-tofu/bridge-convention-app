import type { Hand, HandEvaluation } from "../../../engine/types";
import type {
  FactDefinition,
  FactValue,
  EvaluatedFacts,
  FactCatalog,
  FactEvaluatorFn,
  RelationalFactEvaluatorFn,
  HandFactResolverFn,
} from "../../../core/contracts/fact-catalog";
import type { PosteriorFactProvider, PosteriorFactRequest } from "../../../core/contracts/posterior";
import type { PublicConstraint } from "../../../core/contracts/agreement-module";
import { SHARED_FACTS, num, fv } from "../../../core/contracts/fact-catalog";
import { isBalanced } from "../../../engine/hand-evaluator";

// Re-export FactEvaluatorFn from contracts (canonical location)
export type { FactEvaluatorFn } from "../../../core/contracts/fact-catalog";
export type { HandFactResolverFn } from "../../../core/contracts/fact-catalog";

/**
 * Context for relational fact evaluation. Relational facts derive from
 * hand + publicSnapshot + surfaceBindings, unlike standard facts which
 * derive from hand alone.
 *
 * Two independent binding mechanisms coexist:
 * 1. Clause-level bindings — `resolveFactId()` in meaning-evaluator replaces
 *    `$suit` in clause factId before fact lookup
 * 2. Fact-level relational evaluators — `RelationalFactEvaluatorFn` receives
 *    surfaceBindings as context, producing derived facts like "support for
 *    the bound suit" or "total raise points"
 */
export interface RelationalFactContext {
  readonly bindings?: Readonly<Record<string, string>>;
  readonly publicCommitments?: readonly PublicConstraint[];
}

// ─── Evaluator registry ─────────────────────────────────────

function classifyMajorPattern(spades: number, hearts: number): string {
  const s5 = spades >= 5;
  const h5 = hearts >= 5;
  const s4 = spades >= 4;
  const h4 = hearts >= 4;

  if (s5 && h5) return "five-five";
  if (s5 && h4) return "five-four";
  if (h5 && s4) return "five-four";
  if (s5 || h5) return "one-five";
  if (s4 && h4) return "both-four";
  if (s4 || h4) return "one-four";
  return "none";
}

// ─── Layered evaluators ──────────────────────────────────────

const PRIMITIVE_EVALUATORS = new Map<string, FactEvaluatorFn>([
  ["hand.hcp", (_h, ev) => fv("hand.hcp", ev.hcp)],
  ["hand.suitLength.spades", (_h, ev) =>
    fv("hand.suitLength.spades", ev.shape[0])],
  ["hand.suitLength.hearts", (_h, ev) =>
    fv("hand.suitLength.hearts", ev.shape[1])],
  ["hand.suitLength.diamonds", (_h, ev) =>
    fv("hand.suitLength.diamonds", ev.shape[2])],
  ["hand.suitLength.clubs", (_h, ev) =>
    fv("hand.suitLength.clubs", ev.shape[3])],
  ["hand.isBalanced", (_h, ev) => fv("hand.isBalanced", isBalanced(ev.shape))],
]);

const BRIDGE_DERIVED_EVALUATORS = new Map<string, FactEvaluatorFn>([
  ["bridge.hasFourCardMajor", (_h, _ev, m) =>
    fv("bridge.hasFourCardMajor", num(m, "hand.suitLength.spades") >= 4 || num(m, "hand.suitLength.hearts") >= 4)],
  ["bridge.hasFiveCardMajor", (_h, _ev, m) =>
    fv("bridge.hasFiveCardMajor", num(m, "hand.suitLength.spades") >= 5 || num(m, "hand.suitLength.hearts") >= 5)],
  ["bridge.majorPattern", (_h, _ev, m) =>
    fv("bridge.majorPattern", classifyMajorPattern(
      num(m, "hand.suitLength.spades"),
      num(m, "hand.suitLength.hearts"),
    ))],
  ["bridge.hasShortage", (_h, _ev, m) => {
    const suits = ["hand.suitLength.spades", "hand.suitLength.hearts", "hand.suitLength.diamonds", "hand.suitLength.clubs"];
    const hasShort = suits.some(s => num(m, s) <= 1);
    return fv("bridge.hasShortage", hasShort);
  }],
]);

/** Combined shared evaluators (primitive + bridge-derived). */
const SHARED_EVALUATORS: ReadonlyMap<string, FactEvaluatorFn> = new Map([
  ...PRIMITIVE_EVALUATORS,
  ...BRIDGE_DERIVED_EVALUATORS,
]);

// ─── Relational evaluators ──────────────────────────────────
// Relational facts derive from hand + publicSnapshot + surfaceBindings.
// They run after standard evaluators and receive the relational context.

const SUIT_FACT_IDS: Record<string, string> = {
  spades: "hand.suitLength.spades",
  hearts: "hand.suitLength.hearts",
  diamonds: "hand.suitLength.diamonds",
  clubs: "hand.suitLength.clubs",
};

const ALL_SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;

function suitFactIdFor(suit: string): string | undefined {
  return SUIT_FACT_IDS[suit];
}

const RELATIONAL_EVALUATORS = new Map<string, RelationalFactEvaluatorFn>([
  ["bridge.supportForBoundSuit", (_h, _ev, evaluated, ctx) => {
    const suitFactId = suitFactIdFor(ctx.bindings?.suit ?? "");
    if (!suitFactId) return fv("bridge.supportForBoundSuit", 0);
    return fv("bridge.supportForBoundSuit", num(evaluated, suitFactId));
  }],

  ["bridge.fitWithBoundSuit", (_h, _ev, evaluated, ctx) => {
    const suitFactId = suitFactIdFor(ctx.bindings?.suit ?? "");
    if (!suitFactId) return fv("bridge.fitWithBoundSuit", false);
    const ownLength = num(evaluated, "bridge.supportForBoundSuit");
    // Look for partner's minimum promised length from publicCommitments
    let partnerMin = 0;
    if (ctx.publicCommitments) {
      for (const c of ctx.publicCommitments) {
        if (c.constraint.factId === suitFactId && c.constraint.operator === "gte"
            && typeof c.constraint.value === "number") {
          partnerMin = Math.max(partnerMin, c.constraint.value);
        }
      }
    }
    return fv("bridge.fitWithBoundSuit", ownLength + partnerMin >= 8);
  }],

  ["bridge.shortageInSuit", (_h, _ev, evaluated, ctx) => {
    const suitFactId = suitFactIdFor(ctx.bindings?.suit ?? "");
    if (!suitFactId) return fv("bridge.shortageInSuit", false);
    const length = num(evaluated, suitFactId);
    return fv("bridge.shortageInSuit", length <= 1);
  }],

  ["bridge.totalPointsForRaise", (_h, _ev, evaluated, ctx) => {
    const suit = ctx.bindings?.suit;
    if (!suit || !suitFactIdFor(suit)) return fv("bridge.totalPointsForRaise", 0);
    const hcp = num(evaluated, "hand.hcp");
    // Shortage points: void=3, singleton=2, doubleton=1 for non-trump suits
    let shortagePoints = 0;
    for (const s of ALL_SUITS) {
      if (s === suit) continue;
      const id = SUIT_FACT_IDS[s];
      if (id) {
        const length = num(evaluated, id);
        if (length === 0) shortagePoints += 3;
        else if (length === 1) shortagePoints += 2;
        else if (length === 2) shortagePoints += 1;
      }
    }
    return fv("bridge.totalPointsForRaise", hcp + shortagePoints);
  }],
]);

/** Create a FactCatalog with shared (primitive + bridge-derived) facts and evaluators. */
export function createSharedFactCatalog(): FactCatalog {
  return {
    definitions: SHARED_FACTS,
    evaluators: SHARED_EVALUATORS,
    relationalEvaluators: RELATIONAL_EVALUATORS,
  };
}

// ─── Topological sort ───────────────────────────────────────

function topologicalSort(catalog: readonly FactDefinition[]): FactDefinition[] {
  const byId = new Map<string, FactDefinition>();
  for (const f of catalog) byId.set(f.id, f);

  const visited = new Set<string>();
  const sorted: FactDefinition[] = [];

  function visit(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);
    const def = byId.get(id);
    if (!def) return;
    for (const dep of def.derivesFrom ?? []) {
      visit(dep);
    }
    sorted.push(def);
  }

  for (const f of catalog) {
    visit(f.id);
  }

  return sorted;
}

// ─── Public API ─────────────────────────────────────────────

export function evaluateFacts(
  hand: Hand,
  evaluation: HandEvaluation,
  catalog?: FactCatalog | readonly FactDefinition[],
  relationalContext?: RelationalFactContext,
  posterior?: PosteriorFactProvider,
): EvaluatedFacts {
  let effectiveDefinitions: readonly FactDefinition[];
  let effectiveEvaluators: ReadonlyMap<string, FactEvaluatorFn>;
  let effectiveRelationalEvaluators: ReadonlyMap<string, RelationalFactEvaluatorFn> | undefined;

  if (catalog === undefined || catalog === null) {
    // No catalog — use shared catalog (SHARED_FACTS)
    const shared = createSharedFactCatalog();
    effectiveDefinitions = shared.definitions;
    effectiveEvaluators = shared.evaluators;
    effectiveRelationalEvaluators = shared.relationalEvaluators;
  } else if ("evaluators" in catalog) {
    // FactCatalog object — use its definitions and evaluators
    effectiveDefinitions = catalog.definitions;
    effectiveEvaluators = catalog.evaluators;
    effectiveRelationalEvaluators = catalog.relationalEvaluators;
  } else {
    // Legacy: plain FactDefinition[] — use those definitions with shared evaluators
    effectiveDefinitions = catalog;
    effectiveEvaluators = SHARED_EVALUATORS;
    effectiveRelationalEvaluators = undefined;
  }

  // Standard evaluators: run all non-relational facts
  const actingHandDefs = effectiveDefinitions.filter((f) => f.world === "acting-hand");
  const relEvals = effectiveRelationalEvaluators;
  const standardDefs = relEvals
    ? actingHandDefs.filter((f) => !relEvals.has(f.id))
    : actingHandDefs;
  const sorted = topologicalSort(standardDefs);

  const facts = new Map<string, FactValue>();

  for (const def of sorted) {
    const evaluator = effectiveEvaluators.get(def.id);
    if (evaluator) {
      const value = evaluator(hand, evaluation, facts);
      facts.set(def.id, value);
    }
  }

  // Relational evaluators: run after standard facts, only when relationalContext provided
  if (relationalContext && relEvals) {
    const relationalDefs = actingHandDefs.filter((f) => relEvals.has(f.id));
    const relationalSorted = topologicalSort(relationalDefs);
    for (const def of relationalSorted) {
      const evaluator = relEvals.get(def.id);
      if (evaluator) {
        const value = evaluator(hand, evaluation, facts, relationalContext);
        facts.set(def.id, value);
      }
    }
  }

  // Posterior evaluators: run after all other evaluators.
  // Each PosteriorFactEvaluatorFn handles null internally (see Fail-Open Policy).
  if (posterior && catalog && "posteriorEvaluators" in catalog && catalog.posteriorEvaluators) {
    for (const [factId, evaluator] of catalog.posteriorEvaluators) {
      const request: PosteriorFactRequest = { factId, seatId: "" };
      const value = evaluator(posterior, request);
      facts.set(factId, value);
    }
  }

  return { world: "acting-hand", facts };
}

/**
 * Create a HandFactResolverFn that evaluates any factId against a hand
 * using the catalog's evaluators. Evaluates facts in dependency order
 * (primitives first, then derived) and caches results per call.
 *
 * This is the bridge between the fact catalog and the posterior sampler.
 * The sampler calls this for each constraint clause instead of its
 * hardcoded resolveFactValue().
 */
export function createHandFactResolver(
  catalog?: FactCatalog,
): HandFactResolverFn {
  const effectiveCatalog = catalog ?? createSharedFactCatalog();
  const evaluators = effectiveCatalog.evaluators;
  const definitions = effectiveCatalog.definitions;

  // Pre-compute topological order once
  const actingHandDefs = definitions.filter((f) => f.world === "acting-hand");
  // Filter out relational evaluators — they need context the sampler doesn't have
  const relEvals = effectiveCatalog.relationalEvaluators;
  const standardDefs = relEvals
    ? actingHandDefs.filter((f) => !relEvals.has(f.id))
    : actingHandDefs;
  const sorted = topologicalSort(standardDefs);

  return (hand: Hand, evaluation: HandEvaluation, factId: string): number | boolean | string | undefined => {
    // Fast path: evaluate all facts in topological order (cached per call)
    const facts = new Map<string, FactValue>();
    for (const def of sorted) {
      const evaluator = evaluators.get(def.id);
      if (evaluator) {
        facts.set(def.id, evaluator(hand, evaluation, facts));
      }
    }
    return facts.get(factId)?.value;
  };
}
