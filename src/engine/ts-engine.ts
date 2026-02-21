import { Vulnerability } from "./types";
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
} from "./types";
import type { EnginePort } from "./port";
import { generateDeal } from "./deal-generator";
import {
  evaluateHand,
  getSuitLength,
  isBalanced as checkBalanced,
} from "./hand-evaluator";
import type { BiddingStrategy, BidResult } from "../shared/types";
import type { BiddingContext } from "../conventions/types";
import {
  getLegalCalls as auctionGetLegalCalls,
  addCall as auctionAddCall,
  isAuctionComplete as auctionIsComplete,
  getContract as auctionGetContract,
} from "./auction";
import { calculateScore as scoringCalculateScore } from "./scoring";
import {
  getLegalPlays as playGetLegalPlays,
  getTrickWinner as playGetTrickWinner,
} from "./play";

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

  // Phase 2 — Bidding
  async getLegalCalls(auction: Auction, seat: Seat): Promise<Call[]> {
    return auctionGetLegalCalls(auction, seat);
  }

  async addCall(auction: Auction, entry: AuctionEntry): Promise<Auction> {
    return auctionAddCall(auction, entry);
  }

  async isAuctionComplete(auction: Auction): Promise<boolean> {
    return auctionIsComplete(auction);
  }

  async getContract(auction: Auction): Promise<Contract | null> {
    return auctionGetContract(auction);
  }

  // Phase 2 — Scoring
  async calculateScore(
    contract: Contract,
    tricksWon: number,
    vulnerability: Vulnerability,
  ): Promise<number> {
    return scoringCalculateScore(contract, tricksWon, vulnerability);
  }

  // Phase 2 — Play
  async getLegalPlays(hand: Hand, leadSuit?: Suit): Promise<Card[]> {
    return playGetLegalPlays(hand, leadSuit);
  }

  async getTrickWinner(trick: Trick): Promise<Seat> {
    return playGetTrickWinner(trick);
  }

  // V2 — DDS (not available)
  async solveDeal(_deal: Deal): Promise<DDSolution> {
    throw new Error("DDS not available in V1");
  }

  async suggestPlay(
    _hand: Hand,
    _currentTrick: readonly Card[],
    _trumpSuit: BidSuit | null,
    _previousTricks: readonly (readonly Card[])[],
  ): Promise<Card> {
    throw new Error("DDS not available in V1");
  }

  async suggestBid(
    hand: Hand,
    auction: Auction,
    seat: Seat,
    strategy: BiddingStrategy,
  ): Promise<BidResult> {
    const evaluation = evaluateHand(hand);
    const context: BiddingContext = { hand, auction, seat, evaluation };
    const result = strategy.suggest(context);
    if (result) return result;
    return {
      call: { type: "pass" },
      ruleName: null,
      explanation: "No matching rule — defaulting to pass",
    };
  }
}
