import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import BiddingReview from "../../game/BiddingReview.svelte";
import { Seat, BidSuit } from "../../../engine/types";
import type { BidHistoryEntry } from "../../../stores/game.svelte";

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
  it("renders a table row per bid history entry", () => {
    const bidHistory = [makeEntry(), makeEntry({ seat: Seat.North })];
    const { container } = render(BiddingReview, {
      props: { bidHistory },
    });
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
  });

  it("shows seat label for each entry", () => {
    const bidHistory = [
      makeEntry({ seat: Seat.South }),
      makeEntry({ seat: Seat.North }),
    ];
    const { container } = render(BiddingReview, {
      props: { bidHistory },
    });
    const cells = container.querySelectorAll("tbody td");
    expect(cells[0]?.textContent).toContain("S");
    expect(cells[3]?.textContent).toContain("N");
  });

  it("renders ConventionCallout when ruleName is present", () => {
    const bidHistory = [
      makeEntry({
        ruleName: "stayman-ask",
        explanation: "Asking for major",
        call: { type: "bid", level: 2, strain: BidSuit.Clubs },
      }),
    ];
    const { container } = render(BiddingReview, {
      props: { bidHistory },
    });
    expect(container.textContent).toContain("stayman-ask");
    expect(container.textContent).toContain("Asking for major");
  });

  it("renders plain explanation when ruleName is null", () => {
    const bidHistory = [makeEntry({ ruleName: null, explanation: "User bid" })];
    const { container } = render(BiddingReview, {
      props: { bidHistory },
    });
    expect(container.textContent).toContain("User bid");
  });

  it("highlights user bids with different style", () => {
    const bidHistory = [makeEntry({ isUser: true })];
    const { container } = render(BiddingReview, {
      props: { bidHistory },
    });
    const row = container.querySelector("tbody tr");
    expect(row?.className).toContain("bg-accent-primary-subtle");
  });
});
