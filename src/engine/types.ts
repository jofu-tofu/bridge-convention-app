export enum Suit {
  Clubs = "C",
  Diamonds = "D",
  Hearts = "H",
  Spades = "S",
}

export enum Rank {
  Two = "2",
  Three = "3",
  Four = "4",
  Five = "5",
  Six = "6",
  Seven = "7",
  Eight = "8",
  Nine = "9",
  Ten = "T",
  Jack = "J",
  Queen = "Q",
  King = "K",
  Ace = "A",
}

export interface Card {
  suit: Suit;
  rank: Rank;
}

export enum Seat {
  North = "N",
  East = "E",
  South = "S",
  West = "W",
}

export enum Vulnerability {
  None = "None",
  NorthSouth = "NS",
  EastWest = "EW",
  Both = "Both",
}

export enum BidSuit {
  Clubs = "C",
  Diamonds = "D",
  Hearts = "H",
  Spades = "S",
  NoTrump = "NT",
}

export enum SpecialBid {
  Pass = "Pass",
  Double = "X",
  Redouble = "XX",
}

export interface Hand {
  readonly cards: readonly Card[];
}

export interface ContractBid {
  readonly type: "bid";
  readonly level: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly strain: BidSuit;
}

export interface SpecialCall {
  readonly type: "pass" | "double" | "redouble";
}

export type Call = ContractBid | SpecialCall;

export interface AuctionEntry {
  readonly seat: Seat;
  readonly call: Call;
}

export interface Auction {
  readonly entries: readonly AuctionEntry[];
  readonly isComplete: boolean;
}

export interface Contract {
  readonly level: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly strain: BidSuit;
  readonly doubled: boolean;
  readonly redoubled: boolean;
  readonly declarer: Seat;
}

export interface Deal {
  readonly hands: Record<Seat, Hand>;
  readonly dealer: Seat;
  readonly vulnerability: Vulnerability;
}

export type SuitLength = readonly [number, number, number, number];

export interface DistributionPoints {
  readonly shortness: number;
  readonly length: number;
  readonly total: number;
}

export interface HandEvaluation {
  readonly hcp: number;
  readonly distribution: DistributionPoints;
  readonly shape: SuitLength;
  readonly totalPoints: number;
  readonly strategy: string;
}

export interface HandEvaluationStrategy {
  readonly name: string;
  evaluate(hand: Hand): HandEvaluation;
}

export interface SeatConstraint {
  readonly seat: Seat;
  readonly minHcp?: number;
  readonly maxHcp?: number;
  readonly balanced?: boolean;
  readonly minLength?: Partial<Record<Suit, number>>;
  readonly maxLength?: Partial<Record<Suit, number>>;
  /** OR constraint: at least ONE listed suit meets its minimum length. */
  readonly minLengthAny?: Partial<Record<Suit, number>>;
  /** Escape hatch for exotic constraints. Runs last, after all other checks pass. */
  readonly customCheck?: (hand: Hand) => boolean;
}

export interface DealConstraints {
  readonly seats: readonly SeatConstraint[];
  readonly vulnerability?: Vulnerability;
  readonly dealer?: Seat;
  readonly maxAttempts?: number;
  /** Optional seedable PRNG for deterministic deal generation. */
  readonly rng?: () => number;
}

export interface DealGeneratorResult {
  readonly deal: Deal;
  readonly iterations: number;
  /** @deprecated Always 0. Relaxation was removed in Phase 2. */
  readonly relaxationSteps: number;
}

export interface ParContract {
  readonly level: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly strain: BidSuit;
  readonly declarer: Seat;
  readonly doubled: boolean;
  readonly overtricks: number;
}

export interface ParInfo {
  readonly score: number;
  readonly contracts: readonly ParContract[];
}

export interface DDSolution {
  readonly tricks: Record<Seat, Record<BidSuit, number>>;
  readonly par: ParInfo | null;
}

export interface Score {
  readonly contract: Contract;
  readonly tricksWon: number;
  readonly score: number;
  readonly vulnerability: Vulnerability;
}

export interface PlayedCard {
  readonly card: Card;
  readonly seat: Seat;
}

export interface Trick {
  readonly plays: readonly PlayedCard[];
  readonly trumpSuit?: Suit;
  readonly winner?: Seat;
}
