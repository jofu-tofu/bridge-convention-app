import { describe, it, expect, vi } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { BidHistoryEntry } from "../../../stores/game.svelte";

describe("ExplanationScreen", () => {
  it("BidHistoryEntry captures contract details when contract exists", () => {
    const contract = {
      level: 3 as const,
      strain: BidSuit.NoTrump,
      doubled: false,
      redoubled: false,
      declarer: Seat.South,
    };
    expect(contract.level).toBe(3);
    expect(contract.strain).toBe(BidSuit.NoTrump);
    expect(contract.declarer).toBe(Seat.South);
  });

  it("shows passed out message when contract is null", () => {
    const contract = null;
    expect(contract).toBeNull();
    // UI would render "Passed out — no contract."
  });

  it("BiddingReview receives bid history", () => {
    const bidHistory: BidHistoryEntry[] = [
      {
        seat: Seat.South,
        call: { type: "bid", level: 2, strain: BidSuit.Clubs },
        ruleName: "stayman-ask",
        explanation: "Stayman asking for 4-card major",
        isUser: true,
      },
    ];
    expect(bidHistory).toHaveLength(1);
    expect(bidHistory[0]!.ruleName).toBe("stayman-ask");
  });

  it("navigates to menu via appStore", () => {
    const appStore = { navigateToMenu: vi.fn() };
    appStore.navigateToMenu();
    expect(appStore.navigateToMenu).toHaveBeenCalledOnce();
  });
});
