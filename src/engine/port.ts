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
} from './types';

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
  calculateScore(contract: Contract, tricksWon: number, vulnerable: boolean): Promise<number>;

  // V2 — DDS
  solveDeal(deal: Deal): Promise<DDSolution>;
  suggestPlay(
    hand: Hand,
    currentTrick: readonly Card[],
    trumpSuit: BidSuit | null,
    previousTricks: readonly (readonly Card[])[],
  ): Promise<Card>;
  suggestBid(hand: Hand, auction: Auction, seat: Seat, conventionId?: string): Promise<Call>;
}
