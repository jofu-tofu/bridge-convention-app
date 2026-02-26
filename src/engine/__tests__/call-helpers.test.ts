import { describe, it, expect } from "vitest";
import { callsMatch } from "../call-helpers";
import { BidSuit } from "../types";
import type { Call } from "../types";

describe("callsMatch", () => {
  it("returns true for identical contract bids", () => {
    const a: Call = { type: "bid", level: 1, strain: BidSuit.NoTrump };
    const b: Call = { type: "bid", level: 1, strain: BidSuit.NoTrump };
    expect(callsMatch(a, b)).toBe(true);
  });

  it("returns false for bids with different levels", () => {
    const a: Call = { type: "bid", level: 1, strain: BidSuit.NoTrump };
    const b: Call = { type: "bid", level: 2, strain: BidSuit.NoTrump };
    expect(callsMatch(a, b)).toBe(false);
  });

  it("returns false for bids with different strains", () => {
    const a: Call = { type: "bid", level: 1, strain: BidSuit.Hearts };
    const b: Call = { type: "bid", level: 1, strain: BidSuit.Spades };
    expect(callsMatch(a, b)).toBe(false);
  });

  it("returns true for two passes", () => {
    const a: Call = { type: "pass" };
    const b: Call = { type: "pass" };
    expect(callsMatch(a, b)).toBe(true);
  });

  it("returns true for two doubles", () => {
    const a: Call = { type: "double" };
    const b: Call = { type: "double" };
    expect(callsMatch(a, b)).toBe(true);
  });

  it("returns true for two redoubles", () => {
    const a: Call = { type: "redouble" };
    const b: Call = { type: "redouble" };
    expect(callsMatch(a, b)).toBe(true);
  });

  it("returns false for pass vs bid", () => {
    const a: Call = { type: "pass" };
    const b: Call = { type: "bid", level: 1, strain: BidSuit.Clubs };
    expect(callsMatch(a, b)).toBe(false);
  });

  it("returns false for double vs redouble", () => {
    const a: Call = { type: "double" };
    const b: Call = { type: "redouble" };
    expect(callsMatch(a, b)).toBe(false);
  });
});
