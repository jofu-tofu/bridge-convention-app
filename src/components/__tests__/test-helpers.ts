import type { EnginePort } from "../../engine/port";
import type { Deal, Hand, Call, Auction, AuctionEntry, Contract, Seat, Card, Suit, BidSuit, Trick, Vulnerability, SuitLength, HandEvaluation, DDSolution, DealConstraints } from "../../engine/types";
import { createDeck } from "../../engine/constants";

/**
 * Creates a stub EnginePort for component testing.
 * All methods return sensible defaults that can be overridden.
 */
export function createStubEngine(overrides: Partial<EnginePort> = {}): EnginePort {
  const defaultEngine: EnginePort = {
    async generateDeal(): Promise<Deal> {
      return makeDeal();
    },
    async evaluateHand(): Promise<HandEvaluation> {
      return {
        hcp: 12,
        distribution: { shortness: 0, length: 0, total: 0 },
        shape: [3, 3, 4, 3] as const,
        totalPoints: 12,
        strategy: "HCP",
      };
    },
    async getSuitLength(): Promise<SuitLength> {
      return [3, 3, 4, 3] as const;
    },
    async isBalanced(): Promise<boolean> {
      return true;
    },
    async getLegalCalls(): Promise<Call[]> {
      return [{ type: "pass" }];
    },
    async addCall(auction: Auction, entry: AuctionEntry): Promise<Auction> {
      return {
        entries: [...auction.entries, entry],
        isComplete: false,
      };
    },
    async isAuctionComplete(): Promise<boolean> {
      return false;
    },
    async getContract(): Promise<Contract | null> {
      return null;
    },
    async calculateScore(): Promise<number> {
      return 0;
    },
    async getLegalPlays(): Promise<Card[]> {
      return [];
    },
    async getTrickWinner(): Promise<Seat> {
      return "N" as Seat;
    },
    async solveDeal(): Promise<DDSolution> {
      throw new Error("Not available in test");
    },
    async suggestPlay(): Promise<Card> {
      throw new Error("Not available in test");
    },
    async suggestBid(): Promise<import("../../shared/types").BidResult> {
      return {
        call: { type: "pass" },
        ruleName: null,
        explanation: "Test pass",
      };
    },
  };

  return { ...defaultEngine, ...overrides };
}

/**
 * Creates a minimal valid Deal for testing.
 */
export function makeDeal(): Deal {
  const deck = createDeck();
  return {
    hands: {
      N: { cards: deck.slice(0, 13) },
      E: { cards: deck.slice(13, 26) },
      S: { cards: deck.slice(26, 39) },
      W: { cards: deck.slice(39, 52) },
    } as Record<Seat, Hand>,
    dealer: "N" as Seat,
    vulnerability: "None" as Vulnerability,
  };
}
