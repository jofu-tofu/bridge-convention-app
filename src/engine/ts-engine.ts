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
import type { EnginePort } from './port';
import { generateDeal } from './deal-generator';
import {
  evaluateHand,
  getSuitLength,
  isBalanced as checkBalanced,
} from './hand-evaluator';

export class TsEngine implements EnginePort {
  // Phase 1 — implemented
  async generateDeal(constraints: DealConstraints): Promise<Deal> {
    return generateDeal(constraints).deal;
  }

  // TODO: Phase 2 — resolve _strategy to a HandEvaluationStrategy via registry lookup
  async evaluateHand(hand: Hand, _strategy?: string): Promise<HandEvaluation> {
    return evaluateHand(hand);
  }

  async getSuitLength(hand: Hand): Promise<SuitLength> {
    return getSuitLength(hand);
  }

  async isBalanced(hand: Hand): Promise<boolean> {
    return checkBalanced(getSuitLength(hand));
  }

  // Phase 2 — Bidding (not implemented)
  async getLegalCalls(_auction: Auction, _seat: Seat): Promise<Call[]> {
    throw new Error('Not implemented until Phase 2');
  }

  async addCall(_auction: Auction, _entry: AuctionEntry): Promise<Auction> {
    throw new Error('Not implemented until Phase 2');
  }

  async isAuctionComplete(_auction: Auction): Promise<boolean> {
    throw new Error('Not implemented until Phase 2');
  }

  async getContract(_auction: Auction): Promise<Contract | null> {
    throw new Error('Not implemented until Phase 2');
  }

  // Phase 2 — Scoring (not implemented)
  async calculateScore(_contract: Contract, _tricksWon: number, _vulnerable: boolean): Promise<number> {
    throw new Error('Not implemented until Phase 2');
  }

  // V2 — DDS (not available)
  async solveDeal(_deal: Deal): Promise<DDSolution> {
    throw new Error('DDS not available in V1');
  }

  async suggestPlay(
    _hand: Hand,
    _currentTrick: readonly Card[],
    _trumpSuit: BidSuit | null,
    _previousTricks: readonly (readonly Card[])[],
  ): Promise<Card> {
    throw new Error('DDS not available in V1');
  }

  async suggestBid(_hand: Hand, _auction: Auction, _seat: Seat, _conventionId?: string): Promise<Call> {
    throw new Error('DDS not available in V1');
  }
}
