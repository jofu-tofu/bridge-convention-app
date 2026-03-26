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
import type { SolveBoardResult } from "./dds-wasm";
import { isDDSAvailable, solveDealWasm, solveBoardWasm } from "./dds-client";
import init, * as wasm from "bridge-wasm";

let wasmInitPromise: Promise<void> | null = null;

/** Initialize the WASM module. Must be called once before creating WasmEngine.
 *  Safe to call multiple times — subsequent calls return the same promise. */
export async function initWasm(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = init().then(() => {}).catch((e: unknown) => {
      wasmInitPromise = null; // Allow retry on failure
      throw e;
    });
  }
  await wasmInitPromise;
}

export class WasmEngine implements EnginePort {
  generateDeal(constraints: DealConstraints): Promise<Deal> {
    return Promise.resolve(wasm.generate_deal({ constraints: cleanConstraints(constraints) }));
  }

  evaluateHand(hand: Hand, _strategy?: string): Promise<HandEvaluation> {
    return Promise.resolve(wasm.evaluate_hand({ hand }));
  }

  getSuitLength(hand: Hand): Promise<SuitLength> {
    return Promise.resolve(wasm.get_suit_length({ hand }));
  }

  isBalanced(hand: Hand): Promise<boolean> {
    return Promise.resolve(wasm.is_balanced({ hand }));
  }

  getLegalCalls(auction: Auction, seat: Seat): Promise<Call[]> {
    const calls = wasm.get_legal_calls({ auction, seat }) as Call[];
    return Promise.resolve(calls);
  }

  addCall(auction: Auction, entry: AuctionEntry): Promise<Auction> {
    return Promise.resolve(wasm.add_call({ auction, entry }));
  }

  isAuctionComplete(auction: Auction): Promise<boolean> {
    return Promise.resolve(wasm.is_auction_complete({ auction }));
  }

  getContract(auction: Auction): Promise<Contract | null> {
    return Promise.resolve(wasm.get_contract({ auction }));
  }

  calculateScore(
    contract: Contract,
    tricksWon: number,
    vulnerability: Vulnerability,
  ): Promise<number> {
    return Promise.resolve(wasm.calculate_score({ contract, tricksWon, vulnerability }));
  }

  getLegalPlays(hand: Hand, leadSuit?: Suit): Promise<Card[]> {
    const legalPlays = wasm.get_legal_plays({ hand, leadSuit: leadSuit ?? null }) as Card[];
    return Promise.resolve(legalPlays);
  }

  getTrickWinner(trick: Trick): Promise<Seat> {
    return Promise.resolve(wasm.get_trick_winner({ trick }));
  }

  solveDeal(deal: Deal): Promise<DDSolution> {
    if (!isDDSAvailable()) {
      return Promise.reject(new Error("DDS not available"));
    }
    return solveDealWasm(deal);
  }

  suggestPlay(
    _hand: Hand,
    _currentTrick: readonly Card[],
    _trumpSuit: BidSuit | null,
    _previousTricks: readonly (readonly Card[])[],
  ): Promise<Card> {
    return Promise.reject(new Error("DDS not available in WASM build"));
  }

  solveBoard(
    trump: number,
    first: number,
    currentTrickSuit: number[],
    currentTrickRank: number[],
    remainCardsPBN: string,
  ): Promise<SolveBoardResult> {
    if (!isDDSAvailable()) {
      return Promise.reject(new Error("DDS not available"));
    }
    return solveBoardWasm(trump, first, currentTrickSuit, currentTrickRank, remainCardsPBN);
  }
}
