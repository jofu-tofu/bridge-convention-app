import { describe, it, expect } from "vitest";
import { Seat, Suit, Rank, Vulnerability, BidSuit } from "../types";
import type { Deal, Hand, Card } from "../types";
import {
  dealToPBN,
  handsToPBN,
  packDealsPBN,
  unpackResults,
  suitToDdsIndex,
  trumpToDdsIndex,
  seatToDdsIndex,
  rankToDdsValue,
} from "../dds-wasm";

// -- Helpers --

function makeCard(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

function makeHand(cards: Card[]): Hand {
  return { cards };
}

// Standard test deal: every seat gets 13 known cards
// N: SAK QJT987 D654 C32
// E: SQJ HK654 DAK C765
// S: ST987 H32 DQJ CT98
// W: S6543 HA DT987 CAKQJ4 — wait, that's 14. Let me construct carefully.

// Simpler approach: construct a known deal and verify PBN output
function makeTestDeal(): Deal {
  const N = makeHand([
    makeCard(Suit.Spades, Rank.Ace),
    makeCard(Suit.Spades, Rank.King),
    makeCard(Suit.Hearts, Rank.Queen),
    makeCard(Suit.Hearts, Rank.Jack),
    makeCard(Suit.Hearts, Rank.Ten),
    makeCard(Suit.Hearts, Rank.Nine),
    makeCard(Suit.Hearts, Rank.Eight),
    makeCard(Suit.Diamonds, Rank.Seven),
    makeCard(Suit.Diamonds, Rank.Six),
    makeCard(Suit.Diamonds, Rank.Five),
    makeCard(Suit.Clubs, Rank.Four),
    makeCard(Suit.Clubs, Rank.Three),
    makeCard(Suit.Clubs, Rank.Two),
  ]);
  const E = makeHand([
    makeCard(Suit.Spades, Rank.Queen),
    makeCard(Suit.Spades, Rank.Jack),
    makeCard(Suit.Hearts, Rank.King),
    makeCard(Suit.Hearts, Rank.Six),
    makeCard(Suit.Hearts, Rank.Five),
    makeCard(Suit.Hearts, Rank.Four),
    makeCard(Suit.Diamonds, Rank.Ace),
    makeCard(Suit.Diamonds, Rank.King),
    makeCard(Suit.Clubs, Rank.Seven),
    makeCard(Suit.Clubs, Rank.Six),
    makeCard(Suit.Clubs, Rank.Five),
    makeCard(Suit.Diamonds, Rank.Four),
    makeCard(Suit.Diamonds, Rank.Three),
  ]);
  const S = makeHand([
    makeCard(Suit.Spades, Rank.Ten),
    makeCard(Suit.Spades, Rank.Nine),
    makeCard(Suit.Spades, Rank.Eight),
    makeCard(Suit.Spades, Rank.Seven),
    makeCard(Suit.Hearts, Rank.Three),
    makeCard(Suit.Hearts, Rank.Two),
    makeCard(Suit.Diamonds, Rank.Queen),
    makeCard(Suit.Diamonds, Rank.Jack),
    makeCard(Suit.Clubs, Rank.Ten),
    makeCard(Suit.Clubs, Rank.Nine),
    makeCard(Suit.Clubs, Rank.Eight),
    makeCard(Suit.Diamonds, Rank.Two),
    makeCard(Suit.Clubs, Rank.Ace),
  ]);
  const W = makeHand([
    makeCard(Suit.Spades, Rank.Six),
    makeCard(Suit.Spades, Rank.Five),
    makeCard(Suit.Spades, Rank.Four),
    makeCard(Suit.Spades, Rank.Three),
    makeCard(Suit.Hearts, Rank.Ace),
    makeCard(Suit.Hearts, Rank.Seven),
    makeCard(Suit.Diamonds, Rank.Ten),
    makeCard(Suit.Diamonds, Rank.Nine),
    makeCard(Suit.Diamonds, Rank.Eight),
    makeCard(Suit.Clubs, Rank.King),
    makeCard(Suit.Clubs, Rank.Queen),
    makeCard(Suit.Clubs, Rank.Jack),
    makeCard(Suit.Spades, Rank.Two),
  ]);

  return {
    hands: {
      [Seat.North]: N,
      [Seat.East]: E,
      [Seat.South]: S,
      [Seat.West]: W,
    },
    dealer: Seat.North,
    vulnerability: Vulnerability.None,
  };
}

describe("dealToPBN", () => {
  it("outputs N: prefix", () => {
    const pbn = dealToPBN(makeTestDeal());
    expect(pbn).toMatch(/^N:/);
  });

  it("has suits ordered S.H.D.C with ranks descending", () => {
    const pbn = dealToPBN(makeTestDeal());
    // N hand: S=AK, H=QJT98, D=765, C=432
    const northHand = pbn.slice(2).split(" ")[0];
    expect(northHand).toBe("AK.QJT98.765.432");
  });

  it("separates seats N E S W by spaces", () => {
    const pbn = dealToPBN(makeTestDeal());
    // "N:" + 4 hands separated by spaces
    const parts = pbn.slice(2).split(" ");
    expect(parts).toHaveLength(4);
  });

  it("handles void suits with empty segment", () => {
    // Create a hand with void spades
    const voidDeal = makeTestDeal();
    // Swap N's spades to clubs for a void
    const voidHand = makeHand([
      // No spades
      makeCard(Suit.Hearts, Rank.Queen),
      makeCard(Suit.Hearts, Rank.Jack),
      makeCard(Suit.Hearts, Rank.Ten),
      makeCard(Suit.Hearts, Rank.Nine),
      makeCard(Suit.Hearts, Rank.Eight),
      makeCard(Suit.Diamonds, Rank.Seven),
      makeCard(Suit.Diamonds, Rank.Six),
      makeCard(Suit.Diamonds, Rank.Five),
      makeCard(Suit.Clubs, Rank.Ace),
      makeCard(Suit.Clubs, Rank.King),
      makeCard(Suit.Clubs, Rank.Four),
      makeCard(Suit.Clubs, Rank.Three),
      makeCard(Suit.Clubs, Rank.Two),
    ]);
    const modifiedDeal: Deal = {
      ...voidDeal,
      hands: { ...voidDeal.hands, [Seat.North]: voidHand },
    };
    const pbn = dealToPBN(modifiedDeal);
    const northHand = pbn.slice(2).split(" ")[0];
    // Void spades = empty first segment: ".QJT98.765.AK432"
    expect(northHand).toMatch(/^\./);
  });

  it("orders ranks descending within each suit", () => {
    const pbn = dealToPBN(makeTestDeal());
    // S hand: S=T987, H=32, D=QJ2, C=AT98
    const southHand = pbn.slice(2).split(" ")[2];
    expect(southHand).toBe("T987.32.QJ2.AT98");
  });
});

describe("packDealsPBN", () => {
  it("writes noOfTables=1 at byte 0", () => {
    const pbn = dealToPBN(makeTestDeal());
    // ddTableDealsPBN struct: { int noOfTables; ddTableDealPBN deals[200]; }
    // ddTableDealPBN: { char cards[80]; }
    // Total: 4 + 200*80 = 16004 bytes
    const buffer = new ArrayBuffer(16004);
    const view = new DataView(buffer);
    packDealsPBN(pbn, view);
    expect(view.getInt32(0, true)).toBe(1); // little-endian
  });

  it("writes PBN string starting at byte 4", () => {
    const pbn = dealToPBN(makeTestDeal());
    const buffer = new ArrayBuffer(16004);
    const view = new DataView(buffer);
    packDealsPBN(pbn, view);

    // Read back the string from byte 4
    const bytes: number[] = [];
    for (let i = 4; i < 4 + 80; i++) {
      const b = view.getUint8(i);
      if (b === 0) break;
      bytes.push(b);
    }
    const written = String.fromCharCode(...bytes);
    expect(written).toBe(pbn);
  });
});

describe("unpackResults", () => {
  it("extracts tricks per seat per strain from resTable", () => {
    // ddTablesRes struct: { int noOfBoards; ddTableResults results[200]; }
    // ddTableResults: { int resTable[5][4]; } = 80 bytes
    // Total: 4 + 200*80 = 16004 bytes
    const buffer = new ArrayBuffer(16004);
    const view = new DataView(buffer);

    // Set noOfBoards
    view.setInt32(0, 5, true);

    // resTable[strain][seat], strain order: 0=S,1=H,2=D,3=C,4=NT
    // seat order: 0=N,1=E,2=S,3=W
    // Set some known values at offset 4 (first result)
    const resultOffset = 4;

    // Spades (strain 0): N=7, E=6, S=8, W=5
    view.setInt32(resultOffset + 0, 7, true); // [0][0] = N
    view.setInt32(resultOffset + 4, 6, true); // [0][1] = E
    view.setInt32(resultOffset + 8, 8, true); // [0][2] = S
    view.setInt32(resultOffset + 12, 5, true); // [0][3] = W

    // Hearts (strain 1): N=10, E=3, S=9, W=4
    view.setInt32(resultOffset + 16, 10, true);
    view.setInt32(resultOffset + 20, 3, true);
    view.setInt32(resultOffset + 24, 9, true);
    view.setInt32(resultOffset + 28, 4, true);

    // Diamonds (strain 2): N=5, E=8, S=6, W=7
    view.setInt32(resultOffset + 32, 5, true);
    view.setInt32(resultOffset + 36, 8, true);
    view.setInt32(resultOffset + 40, 6, true);
    view.setInt32(resultOffset + 44, 7, true);

    // Clubs (strain 3): N=4, E=9, S=3, W=10
    view.setInt32(resultOffset + 48, 4, true);
    view.setInt32(resultOffset + 52, 9, true);
    view.setInt32(resultOffset + 56, 3, true);
    view.setInt32(resultOffset + 60, 10, true);

    // NT (strain 4): N=6, E=7, S=5, W=8
    view.setInt32(resultOffset + 64, 6, true);
    view.setInt32(resultOffset + 68, 7, true);
    view.setInt32(resultOffset + 72, 5, true);
    view.setInt32(resultOffset + 76, 8, true);

    const tricks = unpackResults(view, resultOffset);

    // DDS strain mapping: 0=S, 1=H, 2=D, 3=C, 4=NT (from dll.h)
    // DDS seat mapping: 0=N, 1=E, 2=S, 3=W
    expect(tricks[Seat.North][BidSuit.Spades]).toBe(7);
    expect(tricks[Seat.East][BidSuit.Spades]).toBe(6);
    expect(tricks[Seat.South][BidSuit.Spades]).toBe(8);
    expect(tricks[Seat.West][BidSuit.Spades]).toBe(5);

    expect(tricks[Seat.North][BidSuit.Hearts]).toBe(10);
    expect(tricks[Seat.East][BidSuit.Hearts]).toBe(3);

    expect(tricks[Seat.North][BidSuit.Diamonds]).toBe(5);
    expect(tricks[Seat.North][BidSuit.Clubs]).toBe(4);
    expect(tricks[Seat.North][BidSuit.NoTrump]).toBe(6);
  });

  it("maps all strains correctly", () => {
    const buffer = new ArrayBuffer(16004);
    const view = new DataView(buffer);
    const offset = 4;

    // Set all to distinct values: strain * 10 + seat
    for (let strain = 0; strain < 5; strain++) {
      for (let seat = 0; seat < 4; seat++) {
        view.setInt32(
          offset + (strain * 4 + seat) * 4,
          strain * 10 + seat,
          true,
        );
      }
    }

    const tricks = unpackResults(view, offset);

    // Strain 0 = Spades
    expect(tricks[Seat.North][BidSuit.Spades]).toBe(0);
    expect(tricks[Seat.West][BidSuit.Spades]).toBe(3);

    // Strain 4 = NT
    expect(tricks[Seat.North][BidSuit.NoTrump]).toBe(40);
    expect(tricks[Seat.West][BidSuit.NoTrump]).toBe(43);
  });
});

// ─── suitToDdsIndex ─────────────────────────────────────────────────

describe("suitToDdsIndex", () => {
  it("maps all 4 suits to DDS indices (0=S, 1=H, 2=D, 3=C)", () => {
    expect(suitToDdsIndex(Suit.Spades)).toBe(0);
    expect(suitToDdsIndex(Suit.Hearts)).toBe(1);
    expect(suitToDdsIndex(Suit.Diamonds)).toBe(2);
    expect(suitToDdsIndex(Suit.Clubs)).toBe(3);
  });
});

// ─── trumpToDdsIndex ────────────────────────────────────────────────

describe("trumpToDdsIndex", () => {
  it("maps suits to DDS strain indices", () => {
    expect(trumpToDdsIndex(Suit.Spades)).toBe(0);
    expect(trumpToDdsIndex(Suit.Hearts)).toBe(1);
    expect(trumpToDdsIndex(Suit.Diamonds)).toBe(2);
    expect(trumpToDdsIndex(Suit.Clubs)).toBe(3);
  });

  it("maps undefined (NT) to 4", () => {
    expect(trumpToDdsIndex(undefined)).toBe(4);
  });
});

// ─── seatToDdsIndex ─────────────────────────────────────────────────

describe("seatToDdsIndex", () => {
  it("maps all 4 seats to DDS indices (N=0, E=1, S=2, W=3)", () => {
    expect(seatToDdsIndex(Seat.North)).toBe(0);
    expect(seatToDdsIndex(Seat.East)).toBe(1);
    expect(seatToDdsIndex(Seat.South)).toBe(2);
    expect(seatToDdsIndex(Seat.West)).toBe(3);
  });
});

// ─── rankToDdsValue ─────────────────────────────────────────────────

describe("rankToDdsValue", () => {
  it("maps Ace → 14, King → 13, Two → 2", () => {
    expect(rankToDdsValue(Rank.Ace)).toBe(14);
    expect(rankToDdsValue(Rank.King)).toBe(13);
    expect(rankToDdsValue(Rank.Two)).toBe(2);
  });

  it("maps all face cards correctly", () => {
    expect(rankToDdsValue(Rank.Queen)).toBe(12);
    expect(rankToDdsValue(Rank.Jack)).toBe(11);
    expect(rankToDdsValue(Rank.Ten)).toBe(10);
  });
});

// ─── handsToPBN ─────────────────────────────────────────────────────

describe("handsToPBN", () => {
  it("converts full 13-card hands to PBN format", () => {
    const deal = makeTestDeal();
    const pbn = handsToPBN(deal.hands);
    // Should match dealToPBN output since all 13 cards present
    expect(pbn).toBe(dealToPBN(deal));
  });

  it("handles partial hands (mid-play)", () => {
    const hands = {
      [Seat.North]: makeHand([
        makeCard(Suit.Spades, Rank.Ace),
        makeCard(Suit.Hearts, Rank.King),
      ]),
      [Seat.East]: makeHand([
        makeCard(Suit.Diamonds, Rank.Queen),
      ]),
      [Seat.South]: makeHand([
        makeCard(Suit.Clubs, Rank.Jack),
        makeCard(Suit.Clubs, Rank.Ten),
      ]),
      [Seat.West]: makeHand([
        makeCard(Suit.Spades, Rank.Two),
        makeCard(Suit.Hearts, Rank.Three),
        makeCard(Suit.Diamonds, Rank.Four),
      ]),
    };
    const pbn = handsToPBN(hands);
    expect(pbn).toMatch(/^N:/);
    const parts = pbn.slice(2).split(" ");
    expect(parts).toHaveLength(4);
    // N: SA HK no D no C → "A.K.."
    expect(parts[0]).toBe("A.K..");
    // E: no S no H DQ no C → "..Q."
    expect(parts[1]).toBe("..Q.");
    // S: no S no H no D CJT → "...JT"
    expect(parts[2]).toBe("...JT");
    // W: S2 H3 D4 no C → "2.3.4."
    expect(parts[3]).toBe("2.3.4.");
  });
});
