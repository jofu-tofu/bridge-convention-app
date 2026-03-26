import { describe, it, expect } from "vitest";
import { Seat } from "../../../engine/types";
import type { Hand } from "../../../engine/types";
import { computeVisibleSeats } from "../../game/AuctionStepPanel";
import type { BidHistoryEntry } from "../../../service";

function makeHand(label: string): Hand {
  return { cards: [], hcp: 0 } as unknown as Hand;
}

const allHands: Record<Seat, Hand> = {
  [Seat.North]: makeHand("N"),
  [Seat.East]: makeHand("E"),
  [Seat.South]: makeHand("S"),
  [Seat.West]: makeHand("W"),
};

const bidHistory: readonly BidHistoryEntry[] = [
  { seat: Seat.North, call: { type: "bid", level: 1, strain: "C" }, isUser: false },
  { seat: Seat.East, call: { type: "pass" }, isUser: false },
  { seat: Seat.South, call: { type: "bid", level: 1, strain: "H" }, isUser: true },
  { seat: Seat.West, call: { type: "pass" }, isUser: false },
  { seat: Seat.North, call: { type: "bid", level: 2, strain: "H" }, isUser: false },
  { seat: Seat.East, call: { type: "pass" }, isUser: false },
  { seat: Seat.South, call: { type: "pass" }, isUser: true },
  { seat: Seat.West, call: { type: "pass" }, isUser: false },
] as unknown as BidHistoryEntry[];

describe("computeVisibleSeats", () => {
  it("returns all hands when step is null", () => {
    const result = computeVisibleSeats(allHands, Seat.South, bidHistory, null);
    expect(Object.keys(result)).toHaveLength(4);
  });

  it("returns only user seat when step is 0", () => {
    const result = computeVisibleSeats(allHands, Seat.South, bidHistory, 0);
    expect(Object.keys(result)).toEqual([Seat.South]);
  });

  it("reveals North after step 1 (North bid first)", () => {
    const result = computeVisibleSeats(allHands, Seat.South, bidHistory, 1);
    const seats = Object.keys(result).sort();
    expect(seats).toEqual([Seat.North, Seat.South].sort());
  });

  it("reveals North and East after step 2", () => {
    const result = computeVisibleSeats(allHands, Seat.South, bidHistory, 2);
    const seats = Object.keys(result).sort();
    expect(seats).toEqual([Seat.East, Seat.North, Seat.South].sort());
  });

  it("reveals all 4 seats after step 4", () => {
    const result = computeVisibleSeats(allHands, Seat.South, bidHistory, 4);
    expect(Object.keys(result)).toHaveLength(4);
  });

  it("handles step beyond bid count gracefully", () => {
    const result = computeVisibleSeats(allHands, Seat.South, bidHistory, 100);
    expect(Object.keys(result)).toHaveLength(4);
  });
});
