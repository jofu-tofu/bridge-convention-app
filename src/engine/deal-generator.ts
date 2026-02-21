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

const DEFAULT_MAX_ATTEMPTS = 10_000;

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
    constraint.maxLength !== undefined ||
    constraint.minLengthAny !== undefined;

  // When both HCP and shape needed, use single-pass function
  if (needsHcp && needsShape) {
    const { hcp, shape } = calculateHcpAndShape(hand);
    if (constraint.minHcp !== undefined && hcp < constraint.minHcp)
      return false;
    if (constraint.maxHcp !== undefined && hcp > constraint.maxHcp)
      return false;
    if (!checkShapeConstraint(shape, constraint)) return false;
  } else if (needsHcp) {
    const hcp = calculateHcp(hand);
    if (constraint.minHcp !== undefined && hcp < constraint.minHcp)
      return false;
    if (constraint.maxHcp !== undefined && hcp > constraint.maxHcp)
      return false;
  } else if (needsShape) {
    const shape = getSuitLength(hand);
    if (!checkShapeConstraint(shape, constraint)) return false;
  }

  // customCheck runs last, after all standard checks pass
  if (constraint.customCheck !== undefined) {
    try {
      if (!constraint.customCheck(hand)) return false;
    } catch {
      return false;
    }
  }

  return true;
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

  // minLengthAny: at least ONE listed suit meets its minimum
  if (constraint.minLengthAny !== undefined) {
    let anyMet = false;
    for (let i = 0; i < SUIT_ORDER.length; i++) {
      const min = constraint.minLengthAny[SUIT_ORDER[i]!];
      if (min !== undefined && shape[i]! >= min) {
        anyMet = true;
        break;
      }
    }
    if (!anyMet) return false;
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


export function generateDeal(
  constraints: DealConstraints,
  rng?: () => number,
): DealGeneratorResult {
  const dealer = constraints.dealer ?? Seat.North;
  const vulnerability = constraints.vulnerability ?? Vulnerability.None;
  const maxAttempts = constraints.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const shuffled = fisherYatesShuffle(STANDARD_DECK, rng);
    const deal = dealFromShuffled(shuffled, dealer, vulnerability);

    if (checkConstraints(deal, constraints)) {
      return {
        deal,
        iterations: attempt,
        relaxationSteps: 0,
      };
    }
  }

  throw new Error(
    `Failed to generate deal after ${maxAttempts} attempts`,
  );
}
