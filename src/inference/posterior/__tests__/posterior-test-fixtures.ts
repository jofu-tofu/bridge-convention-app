/**
 * Shared test fixtures for posterior inference tests.
 *
 * Consolidates duplicated makeSnapshot/makeHand/southHand/oneNtCommitments
 * from query-port, ts-posterior-backend, boundary-invariants,
 * posterior-compiler, and factor-compiler tests.
 */

import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import type { PublicConstraint } from "../../../core/contracts/agreement-module";
import { ForcingState } from "../../../core/contracts/bidding";
import { Suit, Rank } from "../../../engine/types";
import type { Hand, Card } from "../../../engine/types";

/** Create a minimal PublicSnapshot from commitments. */
export function makeSnapshot(
  commitments: readonly PublicConstraint[],
  latentBranches?: PublicSnapshot["latentBranches"],
): PublicSnapshot {
  return {
    activeModuleIds: [],
    forcingState: ForcingState.Nonforcing,
    obligation: { kind: "none", obligatedSide: "opener" },
    agreedStrain: { type: "none" },
    competitionMode: "uncontested",
    captain: "responder",
    systemCapabilities: {},
    publicRegisters: {},
    publicCommitments: commitments,
    ...(latentBranches ? { latentBranches } : {}),
  };
}

/** Create a Hand from cards. */
export function makeHand(cards: Card[]): Hand {
  return { cards };
}

/** Standard test hand: South 10 HCP, 4=3=3=3 (A♠ K♠ 5♠ 3♠ Q♥ 6♥ 2♥ J♦ 7♦ 4♦ 8♣ 5♣ 3♣). */
export const southHand: Hand = makeHand([
  { suit: Suit.Spades, rank: Rank.Ace },
  { suit: Suit.Spades, rank: Rank.King },
  { suit: Suit.Spades, rank: Rank.Five },
  { suit: Suit.Spades, rank: Rank.Three },
  { suit: Suit.Hearts, rank: Rank.Queen },
  { suit: Suit.Hearts, rank: Rank.Six },
  { suit: Suit.Hearts, rank: Rank.Two },
  { suit: Suit.Diamonds, rank: Rank.Jack },
  { suit: Suit.Diamonds, rank: Rank.Seven },
  { suit: Suit.Diamonds, rank: Rank.Four },
  { suit: Suit.Clubs, rank: Rank.Eight },
  { suit: Suit.Clubs, rank: Rank.Five },
  { suit: Suit.Clubs, rank: Rank.Three },
]);

/** 1NT commitment patterns: 15-17 HCP, balanced. */
export const oneNtCommitments: readonly PublicConstraint[] = [
  {
    subject: "N",
    constraint: { factId: "hand.hcp", operator: "gte", value: 15 },
    origin: "call-meaning",
    strength: "hard",
  },
  {
    subject: "N",
    constraint: { factId: "hand.hcp", operator: "lte", value: 17 },
    origin: "call-meaning",
    strength: "hard",
  },
  {
    subject: "N",
    constraint: { factId: "hand.isBalanced", operator: "boolean", value: true },
    origin: "call-meaning",
    strength: "hard",
  },
];
