import type { EnginePort } from "./port";
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
import { cleanConstraints } from "./constraint-utils";
import init, * as wasm from "bridge-wasm";

let wasmInitPromise: Promise<void> | null = null;

/** Initialize the WASM module. Must be called once before creating WasmEngine.
 *  Safe to call multiple times — subsequent calls return the same promise. */
export async function initWasm(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = init().then(() => {}).catch((e) => {
      wasmInitPromise = null; // Allow retry on failure
      throw e;
    });
  }
  await wasmInitPromise;
}

export class WasmEngine implements EnginePort {
  async generateDeal(constraints: DealConstraints): Promise<Deal> {
    return wasm.generate_deal({ constraints: cleanConstraints(constraints) });
  }

  async evaluateHand(hand: Hand, _strategy?: string): Promise<HandEvaluation> {
    return wasm.evaluate_hand({ hand });
  }

  async getSuitLength(hand: Hand): Promise<SuitLength> {
    return wasm.get_suit_length({ hand });
  }

  async isBalanced(hand: Hand): Promise<boolean> {
    return wasm.is_balanced({ hand });
  }

  async getLegalCalls(auction: Auction, seat: Seat): Promise<Call[]> {
    return wasm.get_legal_calls({ auction, seat });
  }

  async addCall(auction: Auction, entry: AuctionEntry): Promise<Auction> {
    return wasm.add_call({ auction, entry });
  }

  async isAuctionComplete(auction: Auction): Promise<boolean> {
    return wasm.is_auction_complete({ auction });
  }

  async getContract(auction: Auction): Promise<Contract | null> {
    return wasm.get_contract({ auction });
  }

  async calculateScore(
    contract: Contract,
    tricksWon: number,
    vulnerability: Vulnerability,
  ): Promise<number> {
    return wasm.calculate_score({ contract, tricksWon, vulnerability });
  }

  async getLegalPlays(hand: Hand, leadSuit?: Suit): Promise<Card[]> {
    return wasm.get_legal_plays({ hand, leadSuit: leadSuit ?? null });
  }

  async getTrickWinner(trick: Trick): Promise<Seat> {
    return wasm.get_trick_winner({ trick });
  }

  async solveDeal(_deal: Deal): Promise<DDSolution> {
    throw new Error("DDS not available in WASM build");
  }

  async suggestPlay(
    _hand: Hand,
    _currentTrick: readonly Card[],
    _trumpSuit: BidSuit | null,
    _previousTricks: readonly (readonly Card[])[],
  ): Promise<Card> {
    throw new Error("DDS not available in WASM build");
  }
}
