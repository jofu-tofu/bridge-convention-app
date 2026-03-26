import type {
  Deal,
  DealConstraints,
  Hand,
  HandEvaluation,
  SuitLength,
  Call,
  Auction,
  AuctionEntry,
  Contract,
  Seat,
  DDSolution,
  Card,
  BidSuit,
  Suit,
  Trick,
  Vulnerability,
} from "./types";
import type { SolveBoardResult } from "./dds-wasm";

export interface EnginePort {
  // Phase 1 — implemented
  generateDeal(constraints: DealConstraints): Promise<Deal>;
  /** @param strategy - Registry key for evaluation strategy (e.g. 'HCP'). Resolved to a HandEvaluationStrategy at runtime. */
  evaluateHand(hand: Hand, strategy?: string): Promise<HandEvaluation>;
  getSuitLength(hand: Hand): Promise<SuitLength>;
  isBalanced(hand: Hand): Promise<boolean>;

  // Phase 2 — Bidding
  getLegalCalls(auction: Auction, seat: Seat): Promise<Call[]>;
  addCall(auction: Auction, entry: AuctionEntry): Promise<Auction>;
  isAuctionComplete(auction: Auction): Promise<boolean>;
  getContract(auction: Auction): Promise<Contract | null>;

  // Phase 2 — Scoring
  calculateScore(
    contract: Contract,
    tricksWon: number,
    vulnerability: Vulnerability,
  ): Promise<number>;

  // Phase 2 — Play
  getLegalPlays(hand: Hand, leadSuit?: Suit): Promise<Card[]>;
  getTrickWinner(trick: Trick): Promise<Seat>;

  // V2 — DDS
  solveDeal(deal: Deal): Promise<DDSolution>;
  suggestPlay(
    hand: Hand,
    currentTrick: readonly Card[],
    trumpSuit: BidSuit | null,
    previousTricks: readonly (readonly Card[])[],
  ): Promise<Card>;

  /**
   * Solve a board position — returns per-card optimal trick counts.
   * Used by Monte Carlo play strategies. Transport-agnostic: WASM delegates
   * to DDS Web Worker, Tauri can delegate to native DDS, remote service
   * can delegate to server-side solver.
   */
  solveBoard(
    trump: number,
    first: number,
    currentTrickSuit: number[],
    currentTrickRank: number[],
    remainCardsPBN: string,
  ): Promise<SolveBoardResult>;
}
