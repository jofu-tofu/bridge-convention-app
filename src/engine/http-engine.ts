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
  SeatConstraint,
} from "./types";
import type { EnginePort } from "./port";

/** Strip non-serializable fields from seat constraints. */
function cleanSeatConstraint(
  sc: SeatConstraint,
): Omit<SeatConstraint, "customCheck"> {
  const { customCheck: _, ...rest } = sc;
  return rest;
}

/** Strip non-serializable fields (rng, customCheck) from constraints before HTTP.
 *  Preserves `seed` for Rust-side deterministic generation. */
export function cleanConstraints(constraints: DealConstraints): object {
  const { rng: _, ...rest } = constraints;
  return {
    ...rest,
    seats: rest.seats.map(cleanSeatConstraint),
  };
}

export class HttpEngine implements EnginePort {
  constructor(private baseUrl: string) {}

  private async post<T>(method: string, body: object): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<T>;
  }

  async generateDeal(constraints: DealConstraints): Promise<Deal> {
    return this.post<Deal>("generate_deal", {
      constraints: cleanConstraints(constraints),
    });
  }

  async evaluateHand(hand: Hand, _strategy?: string): Promise<HandEvaluation> {
    return this.post<HandEvaluation>("evaluate_hand", { hand });
  }

  async getSuitLength(hand: Hand): Promise<SuitLength> {
    return this.post<SuitLength>("get_suit_length", { hand });
  }

  async isBalanced(hand: Hand): Promise<boolean> {
    return this.post<boolean>("is_balanced", { hand });
  }

  async getLegalCalls(auction: Auction, seat: Seat): Promise<Call[]> {
    return this.post<Call[]>("get_legal_calls", { auction, seat });
  }

  async addCall(auction: Auction, entry: AuctionEntry): Promise<Auction> {
    return this.post<Auction>("add_call", { auction, entry });
  }

  async isAuctionComplete(auction: Auction): Promise<boolean> {
    return this.post<boolean>("is_auction_complete", { auction });
  }

  async getContract(auction: Auction): Promise<Contract | null> {
    return this.post<Contract | null>("get_contract", { auction });
  }

  async calculateScore(
    contract: Contract,
    tricksWon: number,
    vulnerability: Vulnerability,
  ): Promise<number> {
    return this.post<number>("calculate_score", {
      contract,
      tricksWon,
      vulnerability,
    });
  }

  async getLegalPlays(hand: Hand, leadSuit?: Suit): Promise<Card[]> {
    return this.post<Card[]>("get_legal_plays", {
      hand,
      leadSuit: leadSuit ?? null,
    });
  }

  async getTrickWinner(trick: Trick): Promise<Seat> {
    return this.post<Seat>("get_trick_winner", { trick });
  }

  async solveDeal(deal: Deal): Promise<DDSolution> {
    return this.post<DDSolution>("solve_deal", { deal });
  }

  async suggestPlay(
    _hand: Hand,
    _currentTrick: readonly Card[],
    _trumpSuit: BidSuit | null,
    _previousTricks: readonly (readonly Card[])[],
  ): Promise<Card> {
    throw new Error("DDS not available in V1");
  }
}
