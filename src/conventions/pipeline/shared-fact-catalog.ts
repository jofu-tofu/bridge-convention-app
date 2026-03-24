import type {
  FactCatalog,
  FactEvaluatorFn,
  RelationalFactEvaluatorFn,
} from "../core/fact-catalog";
import { SHARED_FACTS } from "../core/shared-facts";
import { num, fv } from "./fact-helpers";
import { isBalanced } from "../../engine/hand-evaluator";
import type { SuitName } from "../../engine/types";

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
export const SHARED_EVALUATORS: ReadonlyMap<string, FactEvaluatorFn> = new Map([
  ...PRIMITIVE_EVALUATORS,
  ...BRIDGE_DERIVED_EVALUATORS,
]);

// ─── Relational evaluators ──────────────────────────────────
// Relational facts derive from hand + publicSnapshot + surfaceBindings.
// They run after standard evaluators and receive the relational context.

const SUIT_FACT_IDS: Record<SuitName, string> = {
  spades: "hand.suitLength.spades",
  hearts: "hand.suitLength.hearts",
  diamonds: "hand.suitLength.diamonds",
  clubs: "hand.suitLength.clubs",
};

const ALL_SUITS: readonly SuitName[] = ["spades", "hearts", "diamonds", "clubs"] as const;

function suitFactIdFor(suit: SuitName): string | undefined {
  return SUIT_FACT_IDS[suit];
}

const RELATIONAL_EVALUATORS = new Map<string, RelationalFactEvaluatorFn>([
  ["bridge.supportForBoundSuit", (_h, _ev, evaluated, ctx) => {
    const boundSuit = ctx.bindings?.suit as SuitName | undefined;
    const suitFactId = boundSuit ? suitFactIdFor(boundSuit) : undefined;
    if (!suitFactId) return fv("bridge.supportForBoundSuit", 0);
    return fv("bridge.supportForBoundSuit", num(evaluated, suitFactId));
  }],

  ["bridge.fitWithBoundSuit", (_h, _ev, evaluated, ctx) => {
    const boundSuit = ctx.bindings?.suit as SuitName | undefined;
    const suitFactId = boundSuit ? suitFactIdFor(boundSuit) : undefined;
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
    const boundSuit = ctx.bindings?.suit as SuitName | undefined;
    const suitFactId = boundSuit ? suitFactIdFor(boundSuit) : undefined;
    if (!suitFactId) return fv("bridge.shortageInSuit", false);
    const length = num(evaluated, suitFactId);
    return fv("bridge.shortageInSuit", length <= 1);
  }],

  ["bridge.totalPointsForRaise", (_h, _ev, evaluated, ctx) => {
    const suit = ctx.bindings?.suit as SuitName | undefined;
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
