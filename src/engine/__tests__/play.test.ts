import { describe, test, expect } from "vitest";
import { Suit, Seat, Rank } from "../types";
import type { Trick, Hand } from "../types";
import { card } from "./fixtures";
import { getLeadSuit, getLegalPlays, getTrickWinner } from "../play";

// Helper to build a hand inline (bypasses createHand's 13-card check)
function makeHand(...notations: string[]): Hand {
  return { cards: notations.map((n) => card(n)) };
}

// A full 13-card hand for tests that need realistic hands
function fullHand(): Hand {
  return makeHand(
    "SA",
    "SK",
    "SQ",
    "HA",
    "HK",
    "HQ",
    "DA",
    "DK",
    "DQ",
    "CA",
    "CK",
    "CQ",
    "CJ",
  );
}

describe("getLegalPlays", () => {
  test("first card of trick — all cards legal", () => {
    const h = fullHand();
    const legal = getLegalPlays(h, undefined);
    expect(legal).toHaveLength(13);
    expect(legal).toEqual([...h.cards]);
  });

  test("must follow suit when holding cards in led suit", () => {
    const h = fullHand(); // has HA, HK, HQ (3 hearts)
    const legal = getLegalPlays(h, Suit.Hearts);
    expect(legal).toHaveLength(3);
    expect(legal.every((c) => c.suit === Suit.Hearts)).toBe(true);
  });

  test("void in led suit — any card legal", () => {
    // Hand with no diamonds
    const h = makeHand(
      "SA",
      "SK",
      "SQ",
      "SJ",
      "HA",
      "HK",
      "HQ",
      "HJ",
      "CA",
      "CK",
      "CQ",
      "CJ",
      "CT",
    );
    const legal = getLegalPlays(h, Suit.Diamonds);
    expect(legal).toHaveLength(13);
  });

  test("not required to trump when void", () => {
    // Hand void in diamonds, has some clubs (trump scenario)
    const h = makeHand(
      "SA",
      "SK",
      "SQ",
      "SJ",
      "HA",
      "HK",
      "HQ",
      "HJ",
      "CA",
      "CK",
      "CQ",
      "CJ",
      "CT",
    );
    // Lead is diamonds, hand is void — all cards legal including trumps and non-trumps
    const legal = getLegalPlays(h, Suit.Diamonds);
    expect(legal).toHaveLength(13);
    // Verify both trump-suit cards and non-trump cards are included
    const clubCards = legal.filter((c) => c.suit === Suit.Clubs);
    const nonClubCards = legal.filter((c) => c.suit !== Suit.Clubs);
    expect(clubCards.length).toBeGreaterThan(0);
    expect(nonClubCards.length).toBeGreaterThan(0);
  });

  test("single card in led suit — must play it", () => {
    // Hand with exactly 1 spade
    const h = makeHand(
      "SA",
      "HA",
      "HK",
      "HQ",
      "HJ",
      "DA",
      "DK",
      "DQ",
      "DJ",
      "CA",
      "CK",
      "CQ",
      "CJ",
    );
    const legal = getLegalPlays(h, Suit.Spades);
    expect(legal).toHaveLength(1);
    expect(legal[0]).toEqual(card("SA"));
  });
});

describe("getLeadSuit", () => {
  test("returns suit of first card played", () => {
    const trick: Trick = {
      plays: [{ card: card("SA"), seat: Seat.North }],
    };
    expect(getLeadSuit(trick)).toBe(Suit.Spades);
  });

  test("returns undefined for empty trick", () => {
    const trick: Trick = { plays: [] };
    expect(getLeadSuit(trick)).toBeUndefined();
  });
});

describe("getTrickWinner — no trump (NT)", () => {
  test("highest card of led suit wins in NT", () => {
    const trick: Trick = {
      plays: [
        { card: card("HJ"), seat: Seat.North },
        { card: card("HQ"), seat: Seat.East },
        { card: card("HK"), seat: Seat.South },
        { card: card("HA"), seat: Seat.West },
      ],
    };
    expect(getTrickWinner(trick)).toBe(Seat.West);
  });

  test("off-suit card cannot win", () => {
    const trick: Trick = {
      plays: [
        { card: card("HK"), seat: Seat.North },
        { card: card("SA"), seat: Seat.East }, // Ace of Spades, but off-suit
        { card: card("H2"), seat: Seat.South },
        { card: card("H3"), seat: Seat.West },
      ],
    };
    expect(getTrickWinner(trick)).toBe(Seat.North); // HK is highest heart
  });

  test("rank ordering: Ace beats King", () => {
    const trick: Trick = {
      plays: [
        { card: card("DK"), seat: Seat.North },
        { card: card("DA"), seat: Seat.East },
        { card: card("D2"), seat: Seat.South },
        { card: card("D3"), seat: Seat.West },
      ],
    };
    expect(getTrickWinner(trick)).toBe(Seat.East);
  });
});

describe("getTrickWinner — with trump", () => {
  test("highest trump wins over any non-trump", () => {
    const trick: Trick = {
      plays: [
        { card: card("SA"), seat: Seat.North }, // Ace of Spades led
        { card: card("C2"), seat: Seat.East }, // lowly trump
        { card: card("SK"), seat: Seat.South },
        { card: card("SQ"), seat: Seat.West },
      ],
      trumpSuit: Suit.Clubs,
    };
    expect(getTrickWinner(trick)).toBe(Seat.East); // C2 trumps
  });

  test("multiple trumps — highest wins", () => {
    const trick: Trick = {
      plays: [
        { card: card("SA"), seat: Seat.North }, // Spade led
        { card: card("C2"), seat: Seat.East }, // low trump
        { card: card("CA"), seat: Seat.South }, // high trump
        { card: card("SJ"), seat: Seat.West },
      ],
      trumpSuit: Suit.Clubs,
    };
    expect(getTrickWinner(trick)).toBe(Seat.South); // CA beats C2
  });

  test("trump suit card in led suit position is just regular follow", () => {
    // Trump is hearts, hearts led — this is just normal follow suit
    const trick: Trick = {
      plays: [
        { card: card("H2"), seat: Seat.North },
        { card: card("HK"), seat: Seat.East },
        { card: card("HA"), seat: Seat.South },
        { card: card("H3"), seat: Seat.West },
      ],
      trumpSuit: Suit.Hearts,
    };
    // All hearts are trump AND led suit — highest heart (Ace) wins
    expect(getTrickWinner(trick)).toBe(Seat.South);
  });

  test("no trump played in trump contract — led suit highest wins", () => {
    const trick: Trick = {
      plays: [
        { card: card("SA"), seat: Seat.North },
        { card: card("SK"), seat: Seat.East },
        { card: card("SQ"), seat: Seat.South },
        { card: card("SJ"), seat: Seat.West },
      ],
      trumpSuit: Suit.Clubs, // clubs are trump but nobody played clubs
    };
    expect(getTrickWinner(trick)).toBe(Seat.North); // SA highest spade
  });
});

describe("getTrickWinner — error handling", () => {
  test("throws if trick has fewer than 4 plays", () => {
    const trick: Trick = {
      plays: [
        { card: card("SA"), seat: Seat.North },
        { card: card("SK"), seat: Seat.East },
      ],
    };
    expect(() => getTrickWinner(trick)).toThrow(
      "Trick must have exactly 4 plays",
    );
  });
});

describe("rank ordering through trick winner behavior", () => {
  test("ace beats every other rank in same suit (bridge rule)", () => {
    const lowerRanks = [
      Rank.King, Rank.Queen, Rank.Jack, Rank.Ten,
      Rank.Nine, Rank.Five, Rank.Two,
    ];
    for (const rank of lowerRanks) {
      const trick: Trick = {
        plays: [
          { card: { suit: Suit.Hearts, rank }, seat: Seat.North },
          { card: { suit: Suit.Hearts, rank: Rank.Ace }, seat: Seat.East },
          { card: { suit: Suit.Spades, rank: Rank.Two }, seat: Seat.South },
          { card: { suit: Suit.Spades, rank: Rank.Three }, seat: Seat.West },
        ],
      };
      expect(getTrickWinner(trick)).toBe(Seat.East);
    }
  });

  test("two is lowest rank — loses to every other rank in same suit", () => {
    const higherRanks = [
      Rank.Three, Rank.Seven, Rank.Ten, Rank.Jack, Rank.King,
    ];
    for (const rank of higherRanks) {
      const trick: Trick = {
        plays: [
          { card: { suit: Suit.Diamonds, rank: Rank.Two }, seat: Seat.North },
          { card: { suit: Suit.Diamonds, rank }, seat: Seat.East },
          { card: { suit: Suit.Clubs, rank: Rank.Two }, seat: Seat.South },
          { card: { suit: Suit.Clubs, rank: Rank.Three }, seat: Seat.West },
        ],
      };
      expect(getTrickWinner(trick)).toBe(Seat.East);
    }
  });
});
