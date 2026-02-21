import { describe, it, expect } from "vitest";
import { createStubEngine, makeDeal } from "./test-helpers";
import { Seat, BidSuit } from "../../engine/types";
import type { Call, Auction } from "../../engine/types";

describe("GameScreen integration", () => {
  it("stub engine provides legal calls", async () => {
    const legalCalls: Call[] = [
      { type: "pass" },
      { type: "bid", level: 1, strain: BidSuit.Clubs },
      { type: "bid", level: 1, strain: BidSuit.NoTrump },
    ];
    const engine = createStubEngine({
      async getLegalCalls() {
        return legalCalls;
      },
    });

    const result = await engine.getLegalCalls(
      { entries: [], isComplete: false },
      Seat.South,
    );
    expect(result).toHaveLength(3);
  });

  it("stub engine adds calls to auction", async () => {
    const engine = createStubEngine();
    const auction: Auction = { entries: [], isComplete: false };
    const result = await engine.addCall(auction, {
      seat: Seat.North,
      call: { type: "bid", level: 1, strain: BidSuit.NoTrump },
    });
    expect(result.entries).toHaveLength(1);
  });

  it("makeDeal creates valid 52-card deal", () => {
    const deal = makeDeal();
    expect(deal.hands.N.cards).toHaveLength(13);
    expect(deal.hands.E.cards).toHaveLength(13);
    expect(deal.hands.S.cards).toHaveLength(13);
    expect(deal.hands.W.cards).toHaveLength(13);
  });
});
