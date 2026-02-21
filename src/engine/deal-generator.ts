import { Seat, Vulnerability } from "./types";
import type {
  Card,
  Hand,
  Deal,
  DealConstraints,
  SeatConstraint,
  SuitLength,
  DealGeneratorResult,
} from "./types";
import { SUIT_ORDER, createDeck } from "./constants";
import {
  calculateHcp,
  calculateHcpAndShape,
  getSuitLength,
  isBalanced,
} from "./hand-evaluator";

/** Module-level deck — created once, never mutated. */
const STANDARD_DECK: readonly Card[] = createDeck();

/** Pre-allocated shuffle buffer — reused across iterations to avoid per-call spread. */
const shuffleBuffer: Card[] = new Array(52);

function fisherYatesShuffle(
  cards: readonly Card[],
  rng: () => number = Math.random,
): Card[] {
  for (let i = 0; i < cards.length; i++) {
    shuffleBuffer[i] = cards[i]!;
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffleBuffer[i]!;
    shuffleBuffer[i] = shuffleBuffer[j]!;
    shuffleBuffer[j] = tmp;
  }
  return shuffleBuffer;
}

function dealFromShuffled(
  cards: Card[],
  dealer: Seat,
  vulnerability: Vulnerability,
): Deal {
  // Construct hands directly — slices are already fresh arrays, skip createHand's defensive copy
  const hands: Record<Seat, Hand> = {
    [Seat.North]: { cards: cards.slice(0, 13) },
    [Seat.East]: { cards: cards.slice(13, 26) },
    [Seat.South]: { cards: cards.slice(26, 39) },
    [Seat.West]: { cards: cards.slice(39, 52) },
  };
  return { hands, dealer, vulnerability };
}

function checkSeatConstraint(hand: Hand, constraint: SeatConstraint): boolean {
  const needsHcp =
    constraint.minHcp !== undefined || constraint.maxHcp !== undefined;
  const needsShape =
    constraint.balanced !== undefined ||
    constraint.minLength !== undefined ||
    constraint.maxLength !== undefined;

  // When both HCP and shape needed, use single-pass function
  if (needsHcp && needsShape) {
    const { hcp, shape } = calculateHcpAndShape(hand);
    if (constraint.minHcp !== undefined && hcp < constraint.minHcp)
      return false;
    if (constraint.maxHcp !== undefined && hcp > constraint.maxHcp)
      return false;
    return checkShapeConstraint(shape, constraint);
  }

  if (needsHcp) {
    const hcp = calculateHcp(hand);
    if (constraint.minHcp !== undefined && hcp < constraint.minHcp)
      return false;
    if (constraint.maxHcp !== undefined && hcp > constraint.maxHcp)
      return false;
  }

  if (!needsShape) return true;

  const shape = getSuitLength(hand);
  return checkShapeConstraint(shape, constraint);
}

function checkShapeConstraint(
  shape: SuitLength,
  constraint: SeatConstraint,
): boolean {
  if (
    constraint.balanced !== undefined &&
    constraint.balanced !== isBalanced(shape)
  ) {
    return false;
  }

  if (constraint.minLength !== undefined) {
    for (let i = 0; i < SUIT_ORDER.length; i++) {
      const min = constraint.minLength[SUIT_ORDER[i]!];
      if (min !== undefined && shape[i]! < min) return false;
    }
  }

  if (constraint.maxLength !== undefined) {
    for (let i = 0; i < SUIT_ORDER.length; i++) {
      const max = constraint.maxLength[SUIT_ORDER[i]!];
      if (max !== undefined && shape[i]! > max) return false;
    }
  }

  return true;
}

export function checkConstraints(
  deal: Deal,
  constraints: DealConstraints,
): boolean {
  for (const seatConstraint of constraints.seats) {
    const hand = deal.hands[seatConstraint.seat];
    if (!checkSeatConstraint(hand, seatConstraint)) return false;
  }
  return true;
}

/** Relaxes HCP bounds only. Shape constraints (balanced, minLength, maxLength) stay fixed. */
export function relaxConstraints(
  constraints: DealConstraints,
  step: number,
): DealConstraints {
  return {
    ...constraints,
    seats: constraints.seats.map((sc) => ({
      ...sc,
      minHcp:
        sc.minHcp !== undefined ? Math.max(0, sc.minHcp - step) : undefined,
      maxHcp:
        sc.maxHcp !== undefined ? Math.min(37, sc.maxHcp + step) : undefined,
    })),
  };
}

export function generateDeal(
  constraints: DealConstraints,
  rng?: () => number,
): DealGeneratorResult {
  const dealer = constraints.dealer ?? Seat.North;
  const vulnerability = constraints.vulnerability ?? Vulnerability.None;
  const maxRelaxationSteps = 10;
  const attemptsPerStep = 1000;

  for (let relaxStep = 0; relaxStep <= maxRelaxationSteps; relaxStep++) {
    const currentConstraints =
      relaxStep === 0 ? constraints : relaxConstraints(constraints, relaxStep);

    for (let attempt = 1; attempt <= attemptsPerStep; attempt++) {
      const shuffled = fisherYatesShuffle(STANDARD_DECK, rng);
      const deal = dealFromShuffled(shuffled, dealer, vulnerability);

      if (checkConstraints(deal, currentConstraints)) {
        return {
          deal,
          iterations: relaxStep * attemptsPerStep + attempt,
          relaxationSteps: relaxStep,
        };
      }
    }
  }

  throw new Error(
    `Failed to generate deal after ${maxRelaxationSteps} relaxation steps (${(maxRelaxationSteps + 1) * attemptsPerStep} attempts)`,
  );
}
