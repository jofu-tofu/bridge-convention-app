import { describe, it, expect, vi } from "vitest";
import { createDrillSession } from "../drill-session";
import type { DrillConfig } from "../types";
import type { BiddingStrategy, BidResult } from "../../shared/types";
import { Seat } from "../../engine/types";
import { createHand, createDeck } from "../../engine/constants";

function makeHand() {
  return createHand(createDeck().slice(0, 13));
}

function makeAuction() {
  return { entries: [], isComplete: false };
}

function makeStrategy(result: BidResult | null): BiddingStrategy {
  return {
    id: "test",
    name: "Test Strategy",
    suggest: vi.fn().mockReturnValue(result),
  };
}

describe("createDrillSession", () => {
  it("returns null for user seat", () => {
    const config: DrillConfig = {
      conventionId: "test",
      userSeat: Seat.South,
      seatStrategies: {
        [Seat.North]: makeStrategy(null),
        [Seat.East]: makeStrategy(null),
        [Seat.South]: "user",
        [Seat.West]: makeStrategy(null),
      },
    };

    const session = createDrillSession(config);
    const result = session.getNextBid(Seat.South, makeHand(), makeAuction());
    expect(result).toBeNull();
  });

  it("delegates to strategy for AI seat", () => {
    const bidResult: BidResult = {
      call: { type: "bid", level: 2, strain: "C" as never },
      ruleName: "test-rule",
      explanation: "Test explanation",
    };
    const strategy = makeStrategy(bidResult);

    const config: DrillConfig = {
      conventionId: "test",
      userSeat: Seat.South,
      seatStrategies: {
        [Seat.North]: strategy,
        [Seat.East]: makeStrategy(null),
        [Seat.South]: "user",
        [Seat.West]: makeStrategy(null),
      },
    };

    const session = createDrillSession(config);
    const result = session.getNextBid(Seat.North, makeHand(), makeAuction());
    expect(result).toEqual(bidResult);
    expect(strategy.suggest).toHaveBeenCalled();
  });

  it("wraps null strategy result as pass", () => {
    const strategy = makeStrategy(null);

    const config: DrillConfig = {
      conventionId: "test",
      userSeat: Seat.South,
      seatStrategies: {
        [Seat.North]: strategy,
        [Seat.East]: makeStrategy(null),
        [Seat.South]: "user",
        [Seat.West]: makeStrategy(null),
      },
    };

    const session = createDrillSession(config);
    const result = session.getNextBid(Seat.North, makeHand(), makeAuction());
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "pass" });
    expect(result!.ruleName).toBeNull();
    expect(result!.explanation).toBe("No matching rule — defaulting to pass");
  });

  it("isUserSeat returns true for user seat only", () => {
    const config: DrillConfig = {
      conventionId: "test",
      userSeat: Seat.South,
      seatStrategies: {
        [Seat.North]: makeStrategy(null),
        [Seat.East]: makeStrategy(null),
        [Seat.South]: "user",
        [Seat.West]: makeStrategy(null),
      },
    };

    const session = createDrillSession(config);
    expect(session.isUserSeat(Seat.South)).toBe(true);
    expect(session.isUserSeat(Seat.North)).toBe(false);
    expect(session.isUserSeat(Seat.East)).toBe(false);
    expect(session.isUserSeat(Seat.West)).toBe(false);
  });
});
