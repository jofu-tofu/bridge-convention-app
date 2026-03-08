import type {
  Card,
  Contract,
  Hand,
  PlayedCard,
  Seat,
  Suit,
  Trick,
} from "../../engine/types";
import type { InferredHoldings } from "./inference";

/** Context passed to play strategies for card selection. */
export interface PlayContext {
  readonly hand: Hand;
  readonly currentTrick: readonly PlayedCard[];
  readonly previousTricks: readonly Trick[];
  readonly contract: Contract;
  readonly seat: Seat;
  readonly trumpSuit: Suit | undefined;
  readonly legalPlays: readonly Card[];
  /** Visible after opening lead; undefined before dummy is revealed. */
  readonly dummyHand?: Hand;
  /** Auction inferences — optional, heuristics degrade gracefully without. */
  readonly inferences?: Record<Seat, InferredHoldings>;
}

export interface PlayResult {
  readonly card: Card;
  readonly reason: string;
}

export interface PlayStrategy {
  readonly id: string;
  readonly name: string;
  suggest(context: PlayContext): PlayResult;
}
