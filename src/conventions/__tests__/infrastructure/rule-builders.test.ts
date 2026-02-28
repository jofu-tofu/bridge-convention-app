import { describe, expect, it } from "vitest";
import { and, or, not } from "../../core/conditions";
import {
  isOpener,
  noPriorBid,
  partnerOpenedMinor,
} from "../../core/conditions";
import { hcpMin, suitMin, isBalanced } from "../../core/conditions";

describe("and() category derivation", () => {
  it("returns 'hand' when all children are hand conditions", () => {
    const combined = and(hcpMin(10), suitMin(0, "spades", 4));
    expect(combined.category).toBe("hand");
  });

  it("returns 'auction' when all children are auction conditions", () => {
    const combined = and(isOpener(), noPriorBid());
    expect(combined.category).toBe("auction");
  });

  it("throws when mixing auction and hand conditions", () => {
    expect(() =>
      and(hcpMin(6), suitMin(1, "hearts", 4), partnerOpenedMinor()),
    ).toThrow(/cannot mix/i);
  });

  it("defaults to 'hand' for empty condition list", () => {
    const combined = and();
    expect(combined.category).toBe("hand");
  });
});

describe("or() category derivation", () => {
  it("returns 'hand' when all children are hand conditions", () => {
    const combined = or(hcpMin(10), isBalanced());
    expect(combined.category).toBe("hand");
  });

  it("returns 'auction' when all children are auction conditions", () => {
    const combined = or(isOpener(), noPriorBid());
    expect(combined.category).toBe("auction");
  });

  it("throws when mixing auction and hand conditions", () => {
    expect(() => or(hcpMin(6), partnerOpenedMinor())).toThrow(/cannot mix/i);
  });
});

describe("not() category preservation", () => {
  it("preserves auction category", () => {
    const negated = not(isOpener());
    expect(negated.category).toBe("auction");
  });

  it("preserves hand category", () => {
    const negated = not(hcpMin(10));
    expect(negated.category).toBe("hand");
  });
});
