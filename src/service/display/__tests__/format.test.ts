import { describe, it, expect } from "vitest";
import { Suit, Rank, BidSuit, Seat } from "../../../engine/types";
import type { Call, Contract } from "../../../engine/types";
import {
  formatRuleName,
  formatCall,
  formatContractWithDeclarer,
  displayRank,
  formatCardLabel,
  displayConventionName,
} from "../format";

describe("formatRuleName", () => {
  it("converts kebab-case to Title Case", () => {
    expect(formatRuleName("stayman-ask")).toBe("Stayman Ask");
  });

  it("converts multi-word kebab-case", () => {
    expect(formatRuleName("gerber-response-zero-four")).toBe(
      "Gerber Response Zero Four",
    );
  });

  it("handles single word", () => {
    expect(formatRuleName("pass")).toBe("Pass");
  });

  it("handles empty string", () => {
    expect(formatRuleName("")).toBe("");
  });

  it("uppercases bridge abbreviations", () => {
    expect(formatRuleName("sayc-open-1nt")).toBe("SAYC Open 1NT");
  });

  it("uppercases DONT abbreviation", () => {
    expect(formatRuleName("dont-2h")).toBe("DONT 2h");
  });

  it("uppercases HCP", () => {
    expect(formatRuleName("hcp-check")).toBe("HCP Check");
  });
});

describe("formatCall", () => {
  it("formats a club bid", () => {
    const call: Call = { type: "bid", level: 1, strain: BidSuit.Clubs };
    expect(formatCall(call)).toBe("1\u2663");
  });

  it("formats a diamond bid", () => {
    const call: Call = { type: "bid", level: 3, strain: BidSuit.Diamonds };
    expect(formatCall(call)).toBe("3\u2666");
  });

  it("formats a heart bid", () => {
    const call: Call = { type: "bid", level: 4, strain: BidSuit.Hearts };
    expect(formatCall(call)).toBe("4\u2665");
  });

  it("formats a spade bid", () => {
    const call: Call = { type: "bid", level: 2, strain: BidSuit.Spades };
    expect(formatCall(call)).toBe("2\u2660");
  });

  it("formats a notrump bid", () => {
    const call: Call = { type: "bid", level: 3, strain: BidSuit.NoTrump };
    expect(formatCall(call)).toBe("3NT");
  });

  it("formats pass", () => {
    expect(formatCall({ type: "pass" })).toBe("Pass");
  });

  it("formats double", () => {
    expect(formatCall({ type: "double" })).toBe("Dbl");
  });

  it("formats redouble", () => {
    expect(formatCall({ type: "redouble" })).toBe("Rdbl");
  });
});

describe("formatContractWithDeclarer", () => {
  it("formats a basic contract", () => {
    const contract: Contract = { level: 3, strain: BidSuit.NoTrump, doubled: false, redoubled: false, declarer: Seat.South };
    expect(formatContractWithDeclarer(contract)).toBe("3NT by S");
  });

  it("formats a doubled contract", () => {
    const contract: Contract = { level: 4, strain: BidSuit.Spades, doubled: true, redoubled: false, declarer: Seat.North };
    expect(formatContractWithDeclarer(contract)).toBe("4\u2660X by N");
  });

  it("formats a redoubled contract", () => {
    const contract: Contract = { level: 6, strain: BidSuit.Hearts, doubled: false, redoubled: true, declarer: Seat.East };
    expect(formatContractWithDeclarer(contract)).toBe("6\u2665XX by E");
  });
});

describe("displayRank", () => {
  it("converts Ten to '10'", () => {
    expect(displayRank(Rank.Ten)).toBe("10");
  });

  it("passes through face cards", () => {
    expect(displayRank(Rank.Ace)).toBe("A");
    expect(displayRank(Rank.King)).toBe("K");
    expect(displayRank(Rank.Queen)).toBe("Q");
    expect(displayRank(Rank.Jack)).toBe("J");
  });

  it("passes through number cards", () => {
    expect(displayRank(Rank.Two)).toBe("2");
    expect(displayRank(Rank.Nine)).toBe("9");
  });
});

describe("formatCardLabel", () => {
  it("formats face cards", () => {
    expect(formatCardLabel(Rank.Queen, Suit.Hearts)).toBe("Queen of Hearts");
    expect(formatCardLabel(Rank.Ace, Suit.Spades)).toBe("Ace of Spades");
  });

  it("formats number cards", () => {
    expect(formatCardLabel(Rank.Ten, Suit.Diamonds)).toBe("10 of Diamonds");
    expect(formatCardLabel(Rank.Two, Suit.Clubs)).toBe("2 of Clubs");
  });

  it("covers all suits", () => {
    expect(formatCardLabel(Rank.King, Suit.Clubs)).toBe("King of Clubs");
    expect(formatCardLabel(Rank.King, Suit.Diamonds)).toBe("King of Diamonds");
    expect(formatCardLabel(Rank.King, Suit.Hearts)).toBe("King of Hearts");
    expect(formatCardLabel(Rank.King, Suit.Spades)).toBe("King of Spades");
  });
});

describe("displayConventionName", () => {
  it("strips (Bundle) suffix", () => {
    expect(displayConventionName("1NT Responses (Bundle)")).toBe("1NT Responses");
  });

  it("strips case-insensitive (bundle) suffix", () => {
    expect(displayConventionName("Bergen Raises (bundle)")).toBe("Bergen Raises");
  });

  it("returns name unchanged when no suffix", () => {
    expect(displayConventionName("Stayman")).toBe("Stayman");
  });

  it("handles empty string", () => {
    expect(displayConventionName("")).toBe("");
  });
});

