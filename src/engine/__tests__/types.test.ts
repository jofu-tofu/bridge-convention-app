import { describe, test, expect } from "vitest";
import { Suit, Rank, Seat, Vulnerability, BidSuit, SpecialBid } from "../types";
import type {
  Card,
  Hand,
  Deal,
  ContractBid,
  SpecialCall,
  Call,
  Auction,
  Contract,
} from "../types";

// ---------------------------------------------------------------------------
// Bridge domain behavior tests — derived from Laws of Duplicate Bridge
// These tests verify bridge domain cardinality, distinctness, and type
// contracts. They do NOT assert specific enum string representations.
// ---------------------------------------------------------------------------

describe("Suit", () => {
  test("bridge has exactly 4 distinct suits", () => {
    const suits = [Suit.Clubs, Suit.Diamonds, Suit.Hearts, Suit.Spades];
    expect(suits).toHaveLength(4);
    expect(new Set(suits).size).toBe(4);
  });

  test("all Object.values are accounted for by the 4 named suits", () => {
    const values = Object.values(Suit);
    expect(values).toHaveLength(4);
    expect(values).toContain(Suit.Clubs);
    expect(values).toContain(Suit.Diamonds);
    expect(values).toContain(Suit.Hearts);
    expect(values).toContain(Suit.Spades);
  });
});

describe("Rank", () => {
  test("bridge has exactly 13 distinct ranks", () => {
    const values = Object.values(Rank);
    expect(values).toHaveLength(13);
    expect(new Set(values).size).toBe(13);
  });

  test("named ranks cover Two through Ace", () => {
    const allRanks = [
      Rank.Two,
      Rank.Three,
      Rank.Four,
      Rank.Five,
      Rank.Six,
      Rank.Seven,
      Rank.Eight,
      Rank.Nine,
      Rank.Ten,
      Rank.Jack,
      Rank.Queen,
      Rank.King,
      Rank.Ace,
    ];
    expect(allRanks).toHaveLength(13);
    expect(new Set(allRanks).size).toBe(13);
  });
});

describe("Card", () => {
  test("card constructed from Suit and Rank retains both", () => {
    const card: Card = { suit: Suit.Spades, rank: Rank.Ace };
    expect(card.suit).toBe(Suit.Spades);
    expect(card.rank).toBe(Rank.Ace);
  });

  test("two cards with same suit and rank are structurally equal", () => {
    const card1: Card = { suit: Suit.Hearts, rank: Rank.King };
    const card2: Card = { suit: Suit.Hearts, rank: Rank.King };
    expect(card1).toEqual(card2);
  });

  test("two cards with different ranks are not equal", () => {
    const card1: Card = { suit: Suit.Hearts, rank: Rank.King };
    const card2: Card = { suit: Suit.Hearts, rank: Rank.Queen };
    expect(card1).not.toEqual(card2);
  });

  test("two cards with different suits are not equal", () => {
    const card1: Card = { suit: Suit.Hearts, rank: Rank.Ace };
    const card2: Card = { suit: Suit.Spades, rank: Rank.Ace };
    expect(card1).not.toEqual(card2);
  });
});

describe("Seat", () => {
  test("bridge has exactly 4 distinct seats", () => {
    const seats = [Seat.North, Seat.East, Seat.South, Seat.West];
    expect(seats).toHaveLength(4);
    expect(new Set(seats).size).toBe(4);
  });

  test("all Object.values are accounted for by the 4 named seats", () => {
    const values = Object.values(Seat);
    expect(values).toHaveLength(4);
    expect(values).toContain(Seat.North);
    expect(values).toContain(Seat.East);
    expect(values).toContain(Seat.South);
    expect(values).toContain(Seat.West);
  });
});

describe("Vulnerability", () => {
  test("bridge has exactly 4 vulnerability states", () => {
    const vulns = [
      Vulnerability.None,
      Vulnerability.NorthSouth,
      Vulnerability.EastWest,
      Vulnerability.Both,
    ];
    expect(vulns).toHaveLength(4);
    expect(new Set(vulns).size).toBe(4);
  });

  test("all Object.values are accounted for by the 4 named states", () => {
    const values = Object.values(Vulnerability);
    expect(values).toHaveLength(4);
    expect(values).toContain(Vulnerability.None);
    expect(values).toContain(Vulnerability.NorthSouth);
    expect(values).toContain(Vulnerability.EastWest);
    expect(values).toContain(Vulnerability.Both);
  });
});

describe("BidSuit", () => {
  test("bridge bidding has 5 strains: 4 suits plus NoTrump", () => {
    const strains = [
      BidSuit.Clubs,
      BidSuit.Diamonds,
      BidSuit.Hearts,
      BidSuit.Spades,
      BidSuit.NoTrump,
    ];
    expect(strains).toHaveLength(5);
    expect(new Set(strains).size).toBe(5);
  });

  test("all Object.values are accounted for by the 5 named strains", () => {
    const values = Object.values(BidSuit);
    expect(values).toHaveLength(5);
  });
});

describe("SpecialBid", () => {
  test("bridge has exactly 3 special calls", () => {
    const specials = [SpecialBid.Pass, SpecialBid.Double, SpecialBid.Redouble];
    expect(specials).toHaveLength(3);
    expect(new Set(specials).size).toBe(3);
  });

  test("all Object.values are accounted for by the 3 named specials", () => {
    const values = Object.values(SpecialBid);
    expect(values).toHaveLength(3);
  });
});

describe("Call discriminated union", () => {
  test("ContractBid carries level (1-7) and strain", () => {
    const bid: ContractBid = { type: "bid", level: 1, strain: BidSuit.NoTrump };
    expect(bid.type).toBe("bid");
    expect(bid.level).toBe(1);
    expect(bid.strain).toBe(BidSuit.NoTrump);
  });

  test("ContractBid level covers all 7 valid levels", () => {
    for (let level = 1; level <= 7; level++) {
      const bid: ContractBid = {
        type: "bid",
        level: level as ContractBid["level"],
        strain: BidSuit.Clubs,
      };
      expect(bid.level).toBe(level);
    }
  });

  test("SpecialCall has type pass, double, or redouble", () => {
    const pass: SpecialCall = { type: "pass" };
    const dbl: SpecialCall = { type: "double" };
    const rdbl: SpecialCall = { type: "redouble" };
    expect(pass.type).toBe("pass");
    expect(dbl.type).toBe("double");
    expect(rdbl.type).toBe("redouble");
  });

  test("Call union discriminates correctly on type field", () => {
    const calls: Call[] = [
      { type: "bid", level: 3, strain: BidSuit.Hearts },
      { type: "pass" },
    ];
    const first = calls[0]!;
    if (first.type === "bid") {
      expect(first.level).toBe(3);
      expect(first.strain).toBe(BidSuit.Hearts);
    } else {
      throw new Error("Expected bid type");
    }
    expect(calls[1]!.type).toBe("pass");
  });
});

describe("composite interfaces", () => {
  test("Hand holds an array of cards", () => {
    const hand: Hand = {
      cards: [
        { suit: Suit.Spades, rank: Rank.Ace },
        { suit: Suit.Hearts, rank: Rank.King },
      ],
    };
    expect(hand.cards).toHaveLength(2);
    expect(hand.cards[0]!.suit).toBe(Suit.Spades);
    expect(hand.cards[1]!.rank).toBe(Rank.King);
  });

  test("Deal contains hands for all 4 seats, a dealer, and vulnerability", () => {
    const emptyHand: Hand = { cards: [] };
    const deal: Deal = {
      hands: {
        [Seat.North]: emptyHand,
        [Seat.East]: emptyHand,
        [Seat.South]: emptyHand,
        [Seat.West]: emptyHand,
      },
      dealer: Seat.North,
      vulnerability: Vulnerability.None,
    };
    expect(deal.dealer).toBe(Seat.North);
    expect(deal.vulnerability).toBe(Vulnerability.None);
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      expect(deal.hands[seat]).toBeDefined();
    }
  });

  test("Auction tracks entries and completion state", () => {
    const auction: Auction = {
      entries: [
        {
          seat: Seat.North,
          call: { type: "bid", level: 1, strain: BidSuit.Clubs },
        },
        { seat: Seat.East, call: { type: "pass" } },
      ],
      isComplete: false,
    };
    expect(auction.entries).toHaveLength(2);
    expect(auction.isComplete).toBe(false);
  });

  test("Contract captures level, strain, doubled state, and declarer", () => {
    const contract: Contract = {
      level: 4,
      strain: BidSuit.Spades,
      doubled: false,
      redoubled: false,
      declarer: Seat.South,
    };
    expect(contract.level).toBe(4);
    expect(contract.strain).toBe(BidSuit.Spades);
    expect(contract.declarer).toBe(Seat.South);
    expect(contract.doubled).toBe(false);
    expect(contract.redoubled).toBe(false);
  });
});
