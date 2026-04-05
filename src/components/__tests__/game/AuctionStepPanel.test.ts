import { describe, it, expect } from "vitest";
import { BidSuit, Seat } from "../../../engine/types";
import { computeVisibleSeats } from "../../game/AuctionStepPanel";
import type { BidHistoryEntry } from "../../../service";
import type { Hand } from "../../../engine/types";

function makeHand(): Hand {
  return { cards: [] };
}

const allHands: Record<Seat, Hand> = {
  [Seat.North]: makeHand(),
  [Seat.East]: makeHand(),
  [Seat.South]: makeHand(),
  [Seat.West]: makeHand(),
};

const bidHistory: readonly BidHistoryEntry[] = [
  { seat: Seat.North, call: { type: "bid", level: 1, strain: BidSuit.Clubs }, isUser: false },
  { seat: Seat.East, call: { type: "pass" }, isUser: false },
  { seat: Seat.South, call: { type: "bid", level: 1, strain: BidSuit.Hearts }, isUser: true },
  { seat: Seat.West, call: { type: "pass" }, isUser: false },
  { seat: Seat.North, call: { type: "bid", level: 2, strain: BidSuit.Hearts }, isUser: false },
  { seat: Seat.East, call: { type: "pass" }, isUser: false },
  { seat: Seat.South, call: { type: "pass" }, isUser: true },
  { seat: Seat.West, call: { type: "pass" }, isUser: false },
] satisfies readonly BidHistoryEntry[];

describe("computeVisibleSeats", () => {
  it("returns only user seat when step is null and no dummy", () => {
    const result = computeVisibleSeats(allHands, Seat.South, bidHistory, null);
    expect(Object.keys(result)).toEqual([Seat.South]);
  });

  it("returns user + dummy when step is null with dummy", () => {
    const result = computeVisibleSeats(allHands, Seat.South, bidHistory, null, Seat.North);
    const seats = Object.keys(result).sort();
    expect(seats).toEqual([Seat.North, Seat.South].sort());
  });

  it("returns only user seat + dummy when step is 0", () => {
    const result = computeVisibleSeats(allHands, Seat.South, bidHistory, 0, Seat.North);
    const seats = Object.keys(result).sort();
    expect(seats).toEqual([Seat.North, Seat.South].sort());
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
