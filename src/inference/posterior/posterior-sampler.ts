import type { PublicHandSpace } from "./posterior-types";
import type { HandPredicate } from "../../conventions/core/agreement-module";
import type { Hand, Card, Seat } from "../../engine/types";
import type { HandFactResolverFn } from "../../conventions/core/fact-catalog";
import { createDeck, SUIT_NAME_MAP } from "../../engine/constants";
import { mulberry32 } from "../../core/util/seeded-rng";
import { calculateHcp, calculateHcpAndShape, isBalanced, evaluateHand } from "../../engine/hand-evaluator";

export interface WeightedDealSample {
  readonly hands: ReadonlyMap<string, Hand>;
  readonly weight: number;
}

/** Fisher-Yates shuffle using provided RNG. */
function shuffle(arr: Card[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = temp;
  }
}

/** Built-in fact resolver for primitive facts (fallback when no catalog resolver provided). */
function resolveFactValueBuiltin(hand: Hand, factId: string): number | boolean | undefined {
  if (factId === "hand.hcp") {
    return calculateHcp(hand);
  }

  if (factId === "hand.isBalanced") {
    const { shape } = calculateHcpAndShape(hand);
    return isBalanced(shape);
  }

  // hand.suitLength.{suit} — supports both short (S/H/D/C) and full names (spades/hearts/...)
  const suitMatch = /^hand\.suitLength\.(.+)$/.exec(factId);
  if (suitMatch) {
    const suitKey = suitMatch[1]!;
    const suit = SUIT_NAME_MAP[suitKey as keyof typeof SUIT_NAME_MAP];
    if (suit !== undefined) {
      return hand.cards.filter((c) => c.suit === suit).length;
    }
  }

  return undefined;
}

/** Resolve a fact value from a hand for constraint checking.
 *  When a catalog-aware resolver is provided, delegates to it.
 *  Otherwise falls back to the built-in primitive resolution. */
function resolveFactValueWithFallback(
  hand: Hand,
  factId: string,
  resolver?: HandFactResolverFn,
): number | boolean | string | undefined {
  if (resolver) {
    const evaluation = evaluateHand(hand);
    return resolver(hand, evaluation, factId);
  }
  return resolveFactValueBuiltin(hand, factId);
}

/** Check one clause of a HandPredicate against a hand. */
function checkClause(
  hand: Hand,
  clause: {
    readonly factId: string;
    readonly operator: "gte" | "lte" | "eq" | "range" | "boolean" | "in";
    readonly value: number | boolean | string | { min: number; max: number } | readonly string[];
  },
  resolver?: HandFactResolverFn,
): boolean {
  const actual = resolveFactValueWithFallback(hand, clause.factId, resolver);
  if (actual === undefined) return true; // Unknown facts pass by default

  switch (clause.operator) {
    case "gte":
      return typeof actual === "number" && typeof clause.value === "number" && actual >= clause.value;
    case "lte":
      return typeof actual === "number" && typeof clause.value === "number" && actual <= clause.value;
    case "eq":
      return actual === clause.value;
    case "range": {
      if (typeof actual !== "number" || typeof clause.value !== "object" || clause.value === null) return false;
      const range = clause.value as { min: number; max: number };
      return actual >= range.min && actual <= range.max;
    }
    case "boolean":
      return actual === clause.value;
    case "in":
      if (Array.isArray(clause.value)) {
        return (clause.value as readonly string[]).includes(String(actual));
      }
      return false;
    default:
      return true;
  }
}

/** Check all constraints of a HandPredicate against a hand. */
function checkPredicate(hand: Hand, predicate: HandPredicate, resolver?: HandFactResolverFn): boolean {
  if (predicate.conjunction === "all") {
    return predicate.clauses.every((c) => checkClause(hand, c, resolver));
  }
  // "any"
  return predicate.clauses.some((c) => checkClause(hand, c, resolver));
}

/** Check if a hand satisfies all constraints for a given seat. */
function satisfiesSpace(hand: Hand, space: PublicHandSpace, resolver?: HandFactResolverFn): boolean {
  return space.constraints.every((predicate) => checkPredicate(hand, predicate, resolver));
}

/** Map Seat enum to string ID. */
function seatToId(seat: Seat): string {
  return seat;
}

/**
 * Sample deals via rejection sampling.
 * Removes own hand's cards, shuffles remainder, deals to 3 other seats,
 * and keeps only deals satisfying all constraints.
 */
export function sampleDeals(
  spaces: readonly PublicHandSpace[],
  ownHand: Hand,
  ownSeat: Seat,
  n: number,
  seed?: number,
  factResolver?: HandFactResolverFn,
): WeightedDealSample[] {
  const rng = mulberry32(seed ?? Date.now());
  const deck = createDeck();

  // Remove own hand's cards
  const ownCardKeys = new Set(
    ownHand.cards.map((c) => `${c.suit}${c.rank}`),
  );
  const remaining = deck.filter((c) => !ownCardKeys.has(`${c.suit}${c.rank}`));

  // Determine order of other seats (excluding own seat)
  const ownSeatId = seatToId(ownSeat);
  const allSeats = ["N", "E", "S", "W"];
  const otherSeats = allSeats.filter((s) => s !== ownSeatId);

  // Build a map of seatId → space for constraint checking
  const spaceMap = new Map<string, PublicHandSpace>();
  for (const space of spaces) {
    spaceMap.set(space.seatId, space);
  }

  const maxAttempts = n * 20;
  const samples: WeightedDealSample[] = [];
  const workingDeck = [...remaining];

  for (let attempt = 0; attempt < maxAttempts && samples.length < n; attempt++) {
    // Copy and shuffle
    for (let i = 0; i < remaining.length; i++) {
      workingDeck[i] = remaining[i]!;
    }
    shuffle(workingDeck, rng);

    // Deal 13 cards to each of 3 other seats
    const hands = new Map<string, Hand>();
    hands.set(ownSeatId, ownHand);

    let valid = true;
    for (let i = 0; i < otherSeats.length; i++) {
      const seatId = otherSeats[i]!;
      const cards = workingDeck.slice(i * 13, (i + 1) * 13);
      const hand: Hand = { cards };

      // Check constraints for this seat
      const space = spaceMap.get(seatId);
      if (space && !satisfiesSpace(hand, space, factResolver)) {
        valid = false;
        break;
      }

      hands.set(seatId, hand);
    }

    if (valid) {
      samples.push({ hands, weight: 1 });
    }
  }

  return samples;
}
