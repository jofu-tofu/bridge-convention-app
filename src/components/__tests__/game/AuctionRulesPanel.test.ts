import { describe, test, expect } from "vitest";
import { render } from "@testing-library/svelte";
import AuctionRulesPanel from "../../game/AuctionRulesPanel.svelte";
import { Seat, BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import type { BidHistoryEntry } from "../../../stores/game.svelte";

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
    conditions: opts.conditions,
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

    const headers = container.querySelectorAll("[data-testid^='round-header']");
    expect(headers).toHaveLength(2);
    expect(headers[0]!.textContent).toContain("Round 1");
    expect(headers[1]!.textContent).toContain("Round 2");
  });

  test("convention bids show rule name", () => {
    const history: BidHistoryEntry[] = [
      entry(Seat.South, "2C", { ruleName: "stayman-ask", isUser: true, isCorrect: true }),
    ];

    const { container } = render(AuctionRulesPanel, {
      props: { bidHistory: history },
    });

    expect(container.textContent).toContain("Stayman Ask");
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

  test("shows conditions when available", () => {
    const conditions = [
      { name: "hcp-min", passed: true, description: "8+ HCP (has 12)" },
      { name: "has-4-major", passed: true, description: "Has 4+ card major (4 hearts)" },
    ];
    const history: BidHistoryEntry[] = [
      entry(Seat.South, "2C", { ruleName: "stayman-ask", conditions }),
    ];

    const { container } = render(AuctionRulesPanel, {
      props: { bidHistory: history },
    });

    expect(container.textContent).toContain("8+ HCP (has 12)");
    expect(container.textContent).toContain("Has 4+ card major");
  });

  test("renders empty state for empty bidHistory", () => {
    const { container } = render(AuctionRulesPanel, {
      props: { bidHistory: [] },
    });

    expect(container.textContent).toContain("No auction data");
  });
});
