import { invoke } from "@tauri-apps/api/core";
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
import type { EnginePort } from "./port";
import type { SolveBoardResult } from "./dds-wasm";
import { cleanConstraints } from "./constraint-utils";

export class TauriIpcEngine implements EnginePort {
  async generateDeal(constraints: DealConstraints): Promise<Deal> {
    return invoke<Deal>("generate_deal", {
      constraints: cleanConstraints(constraints),
    });
  }

  async evaluateHand(hand: Hand, _strategy?: string): Promise<HandEvaluation> {
    return invoke<HandEvaluation>("evaluate_hand", { hand });
  }

  async getSuitLength(hand: Hand): Promise<SuitLength> {
    return invoke<SuitLength>("get_suit_length", { hand });
  }

  async isBalanced(hand: Hand): Promise<boolean> {
    return invoke<boolean>("is_balanced", { hand });
  }

  async getLegalCalls(auction: Auction, seat: Seat): Promise<Call[]> {
    return invoke<Call[]>("get_legal_calls", { auction, seat });
  }

  async addCall(auction: Auction, entry: AuctionEntry): Promise<Auction> {
    return invoke<Auction>("add_call", { auction, entry });
  }

  async isAuctionComplete(auction: Auction): Promise<boolean> {
    return invoke<boolean>("is_auction_complete", { auction });
  }

  async getContract(auction: Auction): Promise<Contract | null> {
    return invoke<Contract | null>("get_contract", { auction });
  }

  async calculateScore(
    contract: Contract,
    tricksWon: number,
    vulnerability: Vulnerability,
  ): Promise<number> {
    return invoke<number>("calculate_score", {
      contract,
      tricksWon,
      vulnerability,
    });
  }

  async getLegalPlays(hand: Hand, leadSuit?: Suit): Promise<Card[]> {
    return invoke<Card[]>("get_legal_plays", {
      hand,
      leadSuit: leadSuit ?? null,
    });
  }

  async getTrickWinner(trick: Trick): Promise<Seat> {
    return invoke<Seat>("get_trick_winner", { trick });
  }

  async solveDeal(deal: Deal): Promise<DDSolution> {
    return invoke<DDSolution>("solve_deal", { deal });
  }

  suggestPlay(
    _hand: Hand,
    _currentTrick: readonly Card[],
    _trumpSuit: BidSuit | null,
    _previousTricks: readonly (readonly Card[])[],
  ): Promise<Card> {
    return Promise.reject(new Error("DDS not available in V1"));
  }

  solveBoard(
    _trump: number,
    _first: number,
    _currentTrickSuit: number[],
    _currentTrickRank: number[],
    _remainCardsPBN: string,
  ): Promise<SolveBoardResult> {
    // Future: invoke("solve_board", { trump, first, ... }) when Rust DDS is wired
    return Promise.reject(new Error("DDS SolveBoard not available in Tauri build"));
  }
}
