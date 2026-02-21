import { describe, test, expect } from "vitest";
import { parseCard, parseHand } from "../notation";
import { Suit, Rank } from "../types";

describe("parseCard", () => {
  test("parses ace of spades", () => {
    const card = parseCard("SA");
    expect(card.suit).toBe(Suit.Spades);
    expect(card.rank).toBe(Rank.Ace);
  });

  test("parses two of clubs", () => {
    const card = parseCard("C2");
    expect(card.suit).toBe(Suit.Clubs);
    expect(card.rank).toBe(Rank.Two);
  });

  test("parses ten notation (T)", () => {
    const card = parseCard("HT");
    expect(card.suit).toBe(Suit.Hearts);
    expect(card.rank).toBe(Rank.Ten);
  });

  test("parses all four suits", () => {
    expect(parseCard("SA").suit).toBe(Suit.Spades);
    expect(parseCard("HA").suit).toBe(Suit.Hearts);
    expect(parseCard("DA").suit).toBe(Suit.Diamonds);
    expect(parseCard("CA").suit).toBe(Suit.Clubs);
  });

  test("parses all ranks", () => {
    const ranks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
    for (const r of ranks) {
      expect(() => parseCard(`S${r}`)).not.toThrow();
    }
  });

  test("throws on invalid suit character", () => {
    expect(() => parseCard("XA")).toThrow("Invalid card notation");
  });

  test("throws on invalid rank character", () => {
    expect(() => parseCard("SZ")).toThrow("Invalid card notation");
  });

  test("throws on empty string", () => {
    expect(() => parseCard("")).toThrow("Invalid card notation");
  });

  test("throws on single character", () => {
    expect(() => parseCard("S")).toThrow("Invalid card notation");
  });

  test("throws on lowercase input 'sa'", () => {
    expect(() => parseCard("sa")).toThrow("Invalid card notation");
  });

  test("throws on mixed case 'Sa'", () => {
    expect(() => parseCard("Sa")).toThrow("Invalid card notation");
  });

  test("throws on leading whitespace ' SA'", () => {
    expect(() => parseCard(" SA")).toThrow("Invalid card notation");
  });

  test("throws on embedded whitespace 'S A'", () => {
    expect(() => parseCard("S A")).toThrow("Invalid card notation");
  });

  test("throws on numeric rank notation 'S10' (use 'ST' instead)", () => {
    expect(() => parseCard("S10")).toThrow("Invalid card notation");
  });
});

describe("parseHand", () => {
  test("parses valid 13-card hand", () => {
    const notations = [
      "SA", "SK", "SQ", "SJ",
      "HA", "HK", "HQ",
      "DA", "DK",
      "CA", "CK", "CQ", "CJ",
    ];
    const hand = parseHand(notations);
    expect(hand.cards).toHaveLength(13);
  });

  test("throws on hand with wrong number of cards", () => {
    expect(() => parseHand(["SA", "SK"])).toThrow();
  });

  test("throws when any card notation is invalid", () => {
    const notations = [
      "SA", "SK", "SQ", "SJ",
      "HA", "HK", "HQ",
      "DA", "DK",
      "CA", "CK", "CQ", "XX",
    ];
    expect(() => parseHand(notations)).toThrow("Invalid card notation");
  });

  test("throws on duplicate cards in hand", () => {
    const notations = [
      "SA", "SA", "SQ", "SJ",
      "HA", "HK", "HQ",
      "DA", "DK",
      "CA", "CK", "CQ", "CJ",
    ];
    expect(() => parseHand(notations)).toThrow();
  });
});
