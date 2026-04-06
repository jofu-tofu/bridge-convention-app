import { describe, it, expect } from "vitest";
import { buildContextSummary } from "../game-screen/context-banner";
import { Seat, BidSuit, PracticeMode } from "../../../service";
import type { AuctionEntryView, Call } from "../../../service";
import { makeBiddingViewport } from "../../../test-support/response-factories";

function makeEntry(seat: Seat, callDisplay: string, type: "pass" | "bid" = "bid", alertLabel?: string): AuctionEntryView {
  const call: Call = type === "pass"
    ? { type: "pass" }
    : { type: "bid", level: 1 as const, strain: BidSuit.NoTrump };
  return { seat, call, callDisplay, alertLabel, meaning: undefined };
}

describe("buildContextSummary", () => {
  it("returns null for full-auction mode", () => {
    const vp = makeBiddingViewport({
      auctionEntries: [makeEntry(Seat.North, "1NT")],
      practiceMode: PracticeMode.FullAuction,
    });
    expect(buildContextSummary(vp)).toBeNull();
  });

  it("returns null for empty auction", () => {
    const vp = makeBiddingViewport({ auctionEntries: [] });
    expect(buildContextSummary(vp)).toBeNull();
  });

  it("returns null when user bids first (no pre-filled entries)", () => {
    const vp = makeBiddingViewport({
      auctionEntries: [makeEntry(Seat.South, "1NT")],
    });
    expect(buildContextSummary(vp)).toBeNull();
  });

  it("summarizes partner opened 1NT with RHO pass", () => {
    const vp = makeBiddingViewport({
      practiceMode: PracticeMode.DecisionDrill,
      auctionEntries: [
        makeEntry(Seat.North, "1NT", "bid", "15-17 HCP balanced"),
        makeEntry(Seat.East, "Pass", "pass"),
      ],
    });
    const result = buildContextSummary(vp);
    expect(result).toBe("Partner opened 1NT (15-17 HCP balanced). RHO passed. Your turn to respond.");
  });

  it("summarizes RHO opening without partner bid", () => {
    const vp = makeBiddingViewport({
      practiceMode: PracticeMode.DecisionDrill,
      auctionEntries: [
        makeEntry(Seat.East, "1NT", "bid"),
      ],
    });
    const result = buildContextSummary(vp);
    expect(result).toBe("RHO opened 1NT. Your turn to bid.");
  });

  it("collapses consecutive passes", () => {
    const vp = makeBiddingViewport({
      practiceMode: PracticeMode.DecisionDrill,
      auctionEntries: [
        makeEntry(Seat.North, "1♥", "bid"),
        makeEntry(Seat.East, "Pass", "pass"),
        makeEntry(Seat.South, "2♥", "bid"), // user's first entry — not pre-filled
      ],
    });
    const result = buildContextSummary(vp);
    expect(result).toBe("Partner opened 1♥. RHO passed. Your turn to respond.");
  });

  it("handles LHO + partner + RHO sequence", () => {
    const vp = makeBiddingViewport({
      practiceMode: PracticeMode.DecisionDrill,
      auctionEntries: [
        makeEntry(Seat.West, "1♣", "bid"),
        makeEntry(Seat.North, "Pass", "pass"),
        makeEntry(Seat.East, "Pass", "pass"),
      ],
    });
    const result = buildContextSummary(vp);
    expect(result).toBe("LHO opened 1♣. Partner and RHO passed. Your turn to bid.");
  });
});
