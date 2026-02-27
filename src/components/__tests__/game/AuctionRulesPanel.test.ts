import { describe, test, expect } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import AuctionRulesPanel from "../../game/AuctionRulesPanel.svelte";
import { Seat, BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import type { BidHistoryEntry } from "../../../stores/game.svelte";
import type { SiblingBid } from "../../../shared/types";

function entry(
  seat: Seat,
  callStr: string,
  opts: Partial<BidHistoryEntry> = {},
): BidHistoryEntry {
  const call: Call =
    callStr === "P"
      ? { type: "pass" }
      : { type: "bid", level: Number(callStr[0]) as 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: callStr.slice(1) as BidSuit };
  return {
    seat,
    call,
    ruleName: opts.ruleName ?? null,
    explanation: opts.explanation ?? "",
    isUser: opts.isUser ?? false,
    isCorrect: opts.isCorrect,
    treePath: opts.treePath,
    meaning: opts.meaning,
  };
}

describe("AuctionRulesPanel", () => {
  test("renders round headers", () => {
    const history: BidHistoryEntry[] = [
      entry(Seat.North, "1NT"),
      entry(Seat.East, "P"),
      entry(Seat.South, "2C"),
      entry(Seat.West, "P"),
      entry(Seat.North, "2H"),
    ];

    const { container } = render(AuctionRulesPanel, {
      props: { bidHistory: history },
    });

    const headers = container.querySelectorAll("[data-testid^='auction-rules-round-header']");
    expect(headers).toHaveLength(2);
    expect(headers[0]!.textContent).toContain("Round 1");
    expect(headers[1]!.textContent).toContain("Round 2");
  });

  test("user bids show correctness indicator", () => {
    const history: BidHistoryEntry[] = [
      entry(Seat.South, "2C", { isUser: true, isCorrect: true }),
      entry(Seat.West, "P"),
      entry(Seat.North, "2H"),
      entry(Seat.East, "P"),
      entry(Seat.South, "3NT", { isUser: true, isCorrect: false }),
    ];

    const { container } = render(AuctionRulesPanel, {
      props: { bidHistory: history },
    });

    const correctMarkers = container.querySelectorAll("[data-testid='bid-correct']");
    const incorrectMarkers = container.querySelectorAll("[data-testid='bid-incorrect']");
    expect(correctMarkers).toHaveLength(1);
    expect(incorrectMarkers).toHaveLength(1);
  });

  test("shows meaning for N/S bids", () => {
    const history: BidHistoryEntry[] = [
      entry(Seat.South, "2C", { meaning: "Stayman, asking for majors" }),
    ];

    const { container } = render(AuctionRulesPanel, {
      props: { bidHistory: history },
    });

    expect(container.textContent).toContain("Stayman, asking for majors");
  });

  test("shows expandable alternatives for N/S bids with siblings", async () => {
    const siblings: SiblingBid[] = [
      {
        bidName: "jacoby-transfer",
        meaning: "Transfer to hearts",
        call: { type: "bid", level: 2, strain: BidSuit.Diamonds },
        failedConditions: [{ name: "hearts-5", description: "Need 5+ hearts" }],
      },
    ];
    const history: BidHistoryEntry[] = [
      entry(Seat.South, "2C", {
        meaning: "Stayman",
        treePath: { matchedNodeName: "stayman-ask", path: [], visited: [], siblings },
      }),
    ];

    const { container } = render(AuctionRulesPanel, {
      props: { bidHistory: history },
    });

    expect(container.textContent).toContain("1 alternative");

    // Expand to see details
    const toggleBtn = container.querySelector("button[aria-expanded]")!;
    await fireEvent.click(toggleBtn);

    expect(container.textContent).toContain("Transfer to hearts");
    expect(container.textContent).toContain("Need 5+ hearts");
  });

  test("renders empty state for empty bidHistory", () => {
    const { container } = render(AuctionRulesPanel, {
      props: { bidHistory: [] },
    });

    expect(container.textContent).toContain("No bids yet");
  });
});
