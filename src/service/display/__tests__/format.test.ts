import { describe, it, expect } from "vitest";
import { formatRuleName, formatBidReferences } from "../format";

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

  it("formats dont as Title Case (not an abbreviation)", () => {
    expect(formatRuleName("dont-2h")).toBe("Dont 2h");
  });

  it("uppercases HCP", () => {
    expect(formatRuleName("hcp-check")).toBe("HCP Check");
  });
});

describe("formatBidReferences", () => {
  it("replaces suit letters with symbols", () => {
    expect(formatBidReferences("2C")).toBe("2♣");
    expect(formatBidReferences("3D")).toBe("3♦");
    expect(formatBidReferences("2H")).toBe("2♥");
    expect(formatBidReferences("4S")).toBe("4♠");
  });

  it("preserves NT", () => {
    expect(formatBidReferences("1NT")).toBe("1NT");
  });

  it("handles multiple bids in text", () => {
    expect(formatBidReferences("Bid 2C or 3D")).toBe("Bid 2♣ or 3♦");
  });

  it("handles slash-separated bids", () => {
    expect(formatBidReferences("2D/2H")).toBe("2♦/2♥");
  });

  it("handles bids in parentheses", () => {
    expect(formatBidReferences("(2C)")).toBe("(2♣)");
  });

  it("does not match inside words", () => {
    expect(formatBidReferences("HCP")).toBe("HCP");
    expect(formatBidReferences("NV")).toBe("NV");
    expect(formatBidReferences("SAYC")).toBe("SAYC");
  });

  it("is idempotent on already-symbolized text", () => {
    expect(formatBidReferences("2♣")).toBe("2♣");
    expect(formatBidReferences("3♥")).toBe("3♥");
  });

  it("handles real authored strings", () => {
    expect(formatBidReferences("Respond 2D with 5+ diamonds"))
      .toBe("Respond 2♦ with 5+ diamonds");
    expect(formatBidReferences("Transfer to hearts via 2D, to spades via 2H"))
      .toBe("Transfer to hearts via 2♦, to spades via 2♥");
  });
});
