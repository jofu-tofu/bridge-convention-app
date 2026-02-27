import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import { fireEvent } from "@testing-library/svelte";
import BiddingReview from "../../game/BiddingReview.svelte";
import { Seat, BidSuit } from "../../../engine/types";
import type { BidHistoryEntry } from "../../../stores/game.svelte";
import type { SiblingBid } from "../../../shared/types";

function makeEntry(overrides: Partial<BidHistoryEntry> = {}): BidHistoryEntry {
  return {
    seat: Seat.South,
    call: { type: "pass" },
    isUser: false,
    ruleName: null,
    explanation: "Test",
    ...overrides,
  };
}

describe("BiddingReview", () => {
  it("renders an entry per bid in round-by-round layout", () => {
    const bidHistory = [
      makeEntry({ seat: Seat.South }),
      makeEntry({ seat: Seat.North }),
    ];
    const { container } = render(BiddingReview, {
      props: { bidHistory },
    });
    expect(container.textContent).toContain("Round 1");
    expect(container.textContent).toContain("S:");
    expect(container.textContent).toContain("N:");
  });

  it("shows correct/incorrect indicators", () => {
    const bidHistory = [
      makeEntry({ seat: Seat.South, isCorrect: true }),
      makeEntry({ seat: Seat.North, isCorrect: false }),
    ];
    const { container } = render(BiddingReview, {
      props: { bidHistory },
    });
    expect(container.querySelector("[aria-label='Correct bid']")).toBeTruthy();
    expect(container.querySelector("[aria-label='Incorrect bid']")).toBeTruthy();
  });

  it("shows meaning for N/S bids", () => {
    const bidHistory = [
      makeEntry({
        seat: Seat.South,
        meaning: "Stayman asking for majors",
        call: { type: "bid", level: 2, strain: BidSuit.Clubs },
      }),
    ];
    const { container } = render(BiddingReview, {
      props: { bidHistory },
    });
    expect(container.textContent).toContain("Stayman asking for majors");
  });

  it("shows expected bid for incorrect user bids", () => {
    const bidHistory = [
      makeEntry({
        seat: Seat.South,
        isUser: true,
        isCorrect: false,
        expectedResult: {
          call: { type: "bid", level: 2, strain: BidSuit.Clubs },
          meaning: "Stayman",
          explanation: "",
          ruleName: "stayman-ask",
        },
      }),
    ];
    const { container } = render(BiddingReview, {
      props: { bidHistory },
    });
    expect(container.textContent).toContain("Expected:");
    expect(container.textContent).toContain("Stayman");
  });

  it("shows alternatives expanded by default with failed conditions", () => {
    const siblings: SiblingBid[] = [
      {
        bidName: "jacoby-transfer",
        meaning: "Transfer to hearts",
        call: { type: "bid", level: 2, strain: BidSuit.Diamonds },
        failedConditions: [{ name: "hearts-5", description: "Need 5+ hearts" }],
      },
      {
        bidName: "stayman-ask",
        meaning: "Stayman",
        call: { type: "bid", level: 2, strain: BidSuit.Clubs },
        failedConditions: [],
      },
    ];
    const bidHistory = [
      makeEntry({
        seat: Seat.South,
        meaning: "Pass",
        treePath: {
          matchedNodeName: "pass",
          path: [],
          visited: [],
          siblings,
        },
      }),
    ];
    const { container } = render(BiddingReview, {
      props: { bidHistory },
    });
    expect(container.textContent).toContain("2 alternatives");
    // Expanded by default — details visible without clicking
    expect(container.textContent).toContain("Transfer to hearts");
    expect(container.textContent).toContain("Need 5+ hearts");
  });

  it("collapses alternatives on click", async () => {
    const siblings: SiblingBid[] = [
      {
        bidName: "jacoby-transfer",
        meaning: "Transfer to hearts",
        call: { type: "bid", level: 2, strain: BidSuit.Diamonds },
        failedConditions: [{ name: "hearts-5", description: "Need 5+ hearts" }],
      },
    ];
    const bidHistory = [
      makeEntry({
        seat: Seat.South,
        meaning: "Pass",
        treePath: {
          matchedNodeName: "pass",
          path: [],
          visited: [],
          siblings,
        },
      }),
    ];
    const { container } = render(BiddingReview, {
      props: { bidHistory },
    });

    // Click to collapse
    const toggleBtn = container.querySelector("button[aria-expanded]")!;
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");
    await fireEvent.click(toggleBtn);

    expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("Transfer to hearts");
  });
});
