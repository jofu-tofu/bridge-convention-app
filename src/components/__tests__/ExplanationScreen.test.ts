import { describe, it, expect } from "vitest";
import type { BidHistoryEntry } from "../../stores/game.svelte";
import { Seat, BidSuit } from "../../engine/types";

describe("ExplanationScreen data", () => {
  it("BidHistoryEntry captures all required fields", () => {
    const entry: BidHistoryEntry = {
      seat: Seat.South,
      call: { type: "bid", level: 2, strain: BidSuit.Clubs },
      ruleName: "stayman-ask",
      explanation: "Stayman asking for 4-card major",
      isUser: true,
    };

    expect(entry.seat).toBe(Seat.South);
    expect(entry.call.type).toBe("bid");
    expect(entry.ruleName).toBe("stayman-ask");
    expect(entry.explanation).toBeTruthy();
    expect(entry.isUser).toBe(true);
  });

  it("BidHistoryEntry handles null ruleName for non-convention bids", () => {
    const entry: BidHistoryEntry = {
      seat: Seat.North,
      call: { type: "pass" },
      ruleName: null,
      explanation: "Always passes (placeholder strategy)",
      isUser: false,
    };

    expect(entry.ruleName).toBeNull();
    expect(entry.isUser).toBe(false);
  });
});
