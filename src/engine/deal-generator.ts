import { Suit, Seat, Vulnerability } from './types';
import type { Card, Hand, Deal, DealConstraints, SeatConstraint, DealGeneratorResult } from './types';
import { SEATS, SUIT_ORDER, createDeck, createHand } from './constants';
import { calculateHcp, getSuitLength, isBalanced } from './hand-evaluator';

function fisherYatesShuffle(cards: Card[]): Card[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

function dealFromShuffled(cards: Card[], dealer: Seat, vulnerability: Vulnerability): Deal {
  const hands: Record<Seat, Hand> = {
    [Seat.North]: createHand(cards.slice(0, 13)),
    [Seat.East]: createHand(cards.slice(13, 26)),
    [Seat.South]: createHand(cards.slice(26, 39)),
    [Seat.West]: createHand(cards.slice(39, 52)),
  };
  return { hands, dealer, vulnerability };
}

function checkSeatConstraint(hand: Hand, constraint: SeatConstraint): boolean {
  if (constraint.minHcp !== undefined || constraint.maxHcp !== undefined) {
    const hcp = calculateHcp(hand);
    if (constraint.minHcp !== undefined && hcp < constraint.minHcp) return false;
    if (constraint.maxHcp !== undefined && hcp > constraint.maxHcp) return false;
  }

  const needsShape = constraint.balanced !== undefined
    || constraint.minLength !== undefined
    || constraint.maxLength !== undefined;
  if (!needsShape) return true;

  const shape = getSuitLength(hand);

  if (constraint.balanced !== undefined && constraint.balanced !== isBalanced(shape)) {
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

export function checkConstraints(deal: Deal, constraints: DealConstraints): boolean {
  for (const seatConstraint of constraints.seats) {
    const hand = deal.hands[seatConstraint.seat];
    if (!checkSeatConstraint(hand, seatConstraint)) return false;
  }
  return true;
}

/** Relaxes HCP bounds only. Shape constraints (balanced, minLength, maxLength) stay fixed. */
function relaxConstraints(constraints: DealConstraints, step: number): DealConstraints {
  return {
    ...constraints,
    seats: constraints.seats.map((sc) => ({
      ...sc,
      minHcp: sc.minHcp !== undefined ? Math.max(0, sc.minHcp - step) : undefined,
      maxHcp: sc.maxHcp !== undefined ? Math.min(37, sc.maxHcp + step) : undefined,
    })),
  };
}

export function generateDeal(constraints: DealConstraints): DealGeneratorResult {
  const deck = createDeck();
  const dealer = constraints.dealer ?? Seat.North;
  const vulnerability = constraints.vulnerability ?? Vulnerability.None;
  const maxRelaxationSteps = 10;
  const attemptsPerStep = 1000;

  for (let relaxStep = 0; relaxStep <= maxRelaxationSteps; relaxStep++) {
    const currentConstraints = relaxStep === 0
      ? constraints
      : relaxConstraints(constraints, relaxStep);

    for (let attempt = 1; attempt <= attemptsPerStep; attempt++) {
      const shuffled = fisherYatesShuffle(deck);
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
