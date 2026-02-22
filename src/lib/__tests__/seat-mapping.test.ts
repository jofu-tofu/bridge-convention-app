import { describe, it, expect } from "vitest";
import { Seat } from "../../engine/types";
import { viewSeat } from "../seat-mapping";

describe("viewSeat", () => {
  it("returns identity for all seats when not rotated", () => {
    expect(viewSeat(Seat.North, false)).toBe(Seat.North);
    expect(viewSeat(Seat.South, false)).toBe(Seat.South);
    expect(viewSeat(Seat.East, false)).toBe(Seat.East);
    expect(viewSeat(Seat.West, false)).toBe(Seat.West);
  });

  it("swaps N↔S and E↔W when rotated", () => {
    expect(viewSeat(Seat.North, true)).toBe(Seat.South);
    expect(viewSeat(Seat.South, true)).toBe(Seat.North);
    expect(viewSeat(Seat.East, true)).toBe(Seat.West);
    expect(viewSeat(Seat.West, true)).toBe(Seat.East);
  });

  it("is self-inverse: viewSeat(viewSeat(seat, true), true) === seat", () => {
    for (const seat of [Seat.North, Seat.South, Seat.East, Seat.West]) {
      expect(viewSeat(viewSeat(seat, true), true)).toBe(seat);
    }
  });
});
