import type { PublicHandSpace } from "../../core/contracts/posterior";
import type { HandPredicateIR } from "../../core/contracts/predicate-surfaces";
import type { Hand, Card, Seat } from "../../engine/types";
import { Suit, Rank } from "../../engine/types";
import { HCP_VALUES } from "../../engine/constants";
import { mulberry32 } from "../../core/util/seeded-rng";
import { calculateHcpAndShape, isBalanced } from "../../engine/hand-evaluator";

export interface WeightedDealSample {
  readonly hands: ReadonlyMap<string, Hand>;
  readonly weight: number;
}

/** All 52 cards in a standard deck. */
function buildDeck(): Card[] {
  const cards: Card[] = [];
  const suits = [Suit.Clubs, Suit.Diamonds, Suit.Hearts, Suit.Spades];
  const ranks = [
    Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
    Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen, Rank.King, Rank.Ace,
  ];
  for (const suit of suits) {
    for (const rank of ranks) {
      cards.push({ suit, rank });
    }
  }
  return cards;
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

/** Resolve a fact value from a hand for constraint checking. */
function resolveFactValue(hand: Hand, factId: string): number | boolean | undefined {
  if (factId === "hand.hcp") {
    return hand.cards.reduce((sum, c) => sum + HCP_VALUES[c.rank], 0);
  }

  if (factId === "hand.isBalanced") {
    const { shape } = calculateHcpAndShape(hand);
    return isBalanced(shape);
  }

  // hand.suitLength.{suit} — supports both short (S/H/D/C) and full names (spades/hearts/...)
  const suitMatch = /^hand\.suitLength\.(.+)$/.exec(factId);
  if (suitMatch) {
    const suitKey = suitMatch[1]!;
    const suitMap: Record<string, Suit> = {
      S: Suit.Spades, H: Suit.Hearts, D: Suit.Diamonds, C: Suit.Clubs,
      spades: Suit.Spades, hearts: Suit.Hearts, diamonds: Suit.Diamonds, clubs: Suit.Clubs,
    };
    const suit = suitMap[suitKey];
    if (suit !== undefined) {
      return hand.cards.filter((c) => c.suit === suit).length;
    }
  }

  return undefined;
}

/** Check one clause of a HandPredicateIR against a hand. */
function checkClause(
  hand: Hand,
  clause: {
    readonly factId: string;
    readonly operator: "gte" | "lte" | "eq" | "range" | "boolean" | "in";
    readonly value: number | boolean | string | { min: number; max: number } | readonly string[];
  },
): boolean {
  const actual = resolveFactValue(hand, clause.factId);
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

/** Check all constraints of a HandPredicateIR against a hand. */
function checkPredicate(hand: Hand, predicate: HandPredicateIR): boolean {
  if (predicate.conjunction === "all") {
    return predicate.clauses.every((c) => checkClause(hand, c));
  }
  // "any"
  return predicate.clauses.some((c) => checkClause(hand, c));
}

/** Check if a hand satisfies all constraints for a given seat. */
function satisfiesSpace(hand: Hand, space: PublicHandSpace): boolean {
  return space.constraints.every((predicate) => checkPredicate(hand, predicate));
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
): WeightedDealSample[] {
  const rng = mulberry32(seed ?? Date.now());
  const deck = buildDeck();

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
      if (space && !satisfiesSpace(hand, space)) {
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
