import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import AuctionTable from "../../game/AuctionTable.svelte";
import { Seat, BidSuit } from "../../../service";
import type { AuctionEntry, BidHistoryEntry } from "../../../service";

describe("AuctionTable", () => {
  it("renders column headers N E S W", () => {
    const { container } = render(AuctionTable, {
      props: { entries: [], dealer: Seat.North },
    });
    const headers = container.querySelectorAll("th");
    expect(headers).toHaveLength(5); // N, E, S, W + info icon column
    expect(headers[0]?.textContent).toBe("N");
    expect(headers[1]?.textContent).toBe("E");
    expect(headers[2]?.textContent).toBe("S");
    expect(headers[3]?.textContent).toBe("W");
  });

  it("renders bids in correct positions", () => {
    const entries: AuctionEntry[] = [
      {
        seat: Seat.North,
        call: { type: "bid", level: 1, strain: BidSuit.NoTrump },
      },
      { seat: Seat.East, call: { type: "pass" } },
      {
        seat: Seat.South,
        call: { type: "bid", level: 2, strain: BidSuit.Clubs },
      },
    ];
    const { container } = render(AuctionTable, {
      props: { entries, dealer: Seat.North },
    });
    const cells = container.querySelectorAll("td");
    expect(cells[0]?.textContent).toContain("1NT");
    expect(cells[1]?.textContent).toContain("Pass");
    expect(cells[2]?.textContent).toContain("2\u2663");
  });

  it("adds dashes for seats before dealer", () => {
    const entries: AuctionEntry[] = [
      { seat: Seat.South, call: { type: "pass" } },
    ];
    const { container } = render(AuctionTable, {
      props: { entries, dealer: Seat.South },
    });
    const cells = container.querySelectorAll("td");
    expect(cells[0]?.textContent).toContain("\u2014");
    expect(cells[1]?.textContent).toContain("\u2014");
    expect(cells[2]?.textContent).toContain("Pass");
  });

  it("applies suit color classes to bid cells", () => {
    const entries: AuctionEntry[] = [
      {
        seat: Seat.North,
        call: { type: "bid", level: 1, strain: BidSuit.Hearts },
      },
    ];
    const { container } = render(AuctionTable, {
      props: { entries, dealer: Seat.North },
    });
    const cells = container.querySelectorAll("td");
    expect(cells[0]?.className).toContain("text-suit-hearts");
  });

  it("renders tooltip for alertable bids with meaning", () => {
    const entries: AuctionEntry[] = [
      { seat: Seat.North, call: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
    ];
    const bidHistory: BidHistoryEntry[] = [
      {
        seat: Seat.North,
        call: { type: "bid", level: 1, strain: BidSuit.NoTrump },
        isUser: false,
        meaning: "15-17 HCP balanced",
        alertLabel: "15 to 17",
        annotationType: "announce",
      },
    ];
    const { container } = render(AuctionTable, {
      props: { entries, dealer: Seat.North, bidHistory },
    });
    const tooltip = container.querySelector("[role='tooltip']");
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toContain("15-17 HCP balanced");
  });

  it("does not render tooltip for educational annotations", () => {
    const entries: AuctionEntry[] = [
      { seat: Seat.North, call: { type: "bid", level: 2, strain: BidSuit.Clubs } },
    ];
    const bidHistory: BidHistoryEntry[] = [
      {
        seat: Seat.North,
        call: { type: "bid", level: 2, strain: BidSuit.Clubs },
        isUser: false,
        meaning: "Stayman",
        alertLabel: "Asking for majors",
        annotationType: "educational",
      },
    ];
    const { container } = render(AuctionTable, {
      props: { entries, dealer: Seat.North, bidHistory },
    });
    const tooltip = container.querySelector("[role='tooltip']");
    expect(tooltip).toBeNull();
  });

  it("does not render tooltip for bids without meaning", () => {
    const entries: AuctionEntry[] = [
      { seat: Seat.North, call: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
    ];
    const bidHistory: BidHistoryEntry[] = [
      {
        seat: Seat.North,
        call: { type: "bid", level: 1, strain: BidSuit.NoTrump },
        isUser: false,
        alertLabel: "15 to 17",
        annotationType: "announce",
      },
    ];
    const { container } = render(AuctionTable, {
      props: { entries, dealer: Seat.North, bidHistory },
    });
    const tooltip = container.querySelector("[role='tooltip']");
    expect(tooltip).toBeNull();
  });

  it("handles compact mode", () => {
    const { container } = render(AuctionTable, {
      props: { entries: [], dealer: Seat.North, compact: true },
    });
    const table = container.querySelector("table");
    expect(table?.className).toContain("text-[--text-label]");
  });

  it("renders multiple rows for long auctions", () => {
    const entries: AuctionEntry[] = [
      {
        seat: Seat.North,
        call: { type: "bid", level: 1, strain: BidSuit.Clubs },
      },
      { seat: Seat.East, call: { type: "pass" } },
      { seat: Seat.South, call: { type: "pass" } },
      { seat: Seat.West, call: { type: "pass" } },
      {
        seat: Seat.North,
        call: { type: "bid", level: 2, strain: BidSuit.Clubs },
      },
    ];
    const { container } = render(AuctionTable, {
      props: { entries, dealer: Seat.North },
    });
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});
