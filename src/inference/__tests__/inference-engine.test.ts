import { describe, it, expect } from "vitest";
import { createInferenceEngine } from "../inference-engine";
import type { InferenceProvider, HandInference, InferenceConfig } from "../types";
import { Seat, BidSuit } from "../../engine/types";
import type { AuctionEntry, Auction } from "../../engine/types";
import { FactOperator } from "../../conventions/pipeline/evaluation/meaning";

function makeProvider(result: HandInference | null = null): InferenceProvider & { calls: AuctionEntry[] } {
  const calls: AuctionEntry[] = [];
  return {
    id: "test-provider",
    name: "test-provider",
    calls,
    inferFromBid(entry: AuctionEntry) {
      calls.push(entry);
      return result;
    },
  };
}

function makeThrowingProvider(): InferenceProvider {
  return {
    id: "throwing",
    name: "throwing",
    inferFromBid() {
      throw new Error("provider exploded");
    },
  };
}

function makeConfig(own: InferenceProvider, opponent: InferenceProvider): InferenceConfig {
  return {
    ownPartnership: own,
    opponentPartnership: opponent,
  };
}

function bid1NT(): AuctionEntry {
  return { seat: Seat.North, call: { type: "bid", level: 1, strain: BidSuit.NoTrump } };
}

function passEntry(seat: Seat): AuctionEntry {
  return { seat, call: { type: "pass" } };
}

const emptyAuction: Auction = { entries: [], isComplete: false };

describe("createInferenceEngine", () => {
  it("routes own partnership bids to ownPartnership provider", () => {
    const own = makeProvider();
    const opponent = makeProvider();
    const engine = createInferenceEngine(makeConfig(own, opponent), Seat.South);

    const entry = bid1NT(); // North bids — same partnership as South observer
    engine.processBid(entry, emptyAuction);

    expect(own.calls).toHaveLength(1);
    expect(own.calls[0]).toBe(entry);
    expect(opponent.calls).toHaveLength(0);
  });

  it("routes opponent bids to opponentPartnership provider", () => {
    const own = makeProvider();
    const opponent = makeProvider();
    const engine = createInferenceEngine(makeConfig(own, opponent), Seat.South);

    const entry = { seat: Seat.East, call: { type: "pass" as const } };
    engine.processBid(entry, emptyAuction);

    expect(opponent.calls).toHaveLength(1);
    expect(own.calls).toHaveLength(0);
  });

  it("routes partner bids to ownPartnership provider", () => {
    const own = makeProvider();
    const opponent = makeProvider();
    const engine = createInferenceEngine(makeConfig(own, opponent), Seat.North);

    // South is North's partner
    const entry = passEntry(Seat.South);
    engine.processBid(entry, emptyAuction);

    expect(own.calls).toHaveLength(1);
    expect(opponent.calls).toHaveLength(0);
  });

  it("routes West bids to opponentPartnership when observer is North", () => {
    const own = makeProvider();
    const opponent = makeProvider();
    const engine = createInferenceEngine(makeConfig(own, opponent), Seat.North);

    const entry = passEntry(Seat.West);
    engine.processBid(entry, emptyAuction);

    expect(opponent.calls).toHaveLength(1);
    expect(own.calls).toHaveLength(0);
  });

  it("accumulates constraints and returns derived beliefs", () => {
    const inference: HandInference = {
      seat: Seat.North,
      source: "test",
      minHcp: 15,
      maxHcp: 17,
      suits: {},
    };
    const own = makeProvider(inference);
    const opponent = makeProvider();
    const engine = createInferenceEngine(makeConfig(own, opponent), Seat.South);

    engine.processBid(bid1NT(), emptyAuction);
    const result = engine.getBeliefs();

    expect(result[Seat.North].ranges.hcp.min).toBe(15);
    expect(result[Seat.North].ranges.hcp.max).toBe(17);
    // Other seats should have wide-open defaults
    expect(result[Seat.South].ranges.hcp.min).toBe(0);
    expect(result[Seat.South].ranges.hcp.max).toBe(40);
  });

  it("does not push constraints from null inference", () => {
    const own = makeProvider(null);
    const opponent = makeProvider();
    const engine = createInferenceEngine(makeConfig(own, opponent), Seat.South);

    engine.processBid(bid1NT(), emptyAuction);
    const result = engine.getBeliefs();

    // North should have wide-open defaults since null inference was not pushed
    expect(result[Seat.North].ranges.hcp.min).toBe(0);
    expect(result[Seat.North].ranges.hcp.max).toBe(40);
  });

  it("swallows provider errors silently", () => {
    const own = makeThrowingProvider();
    const opponent = makeProvider();
    const engine = createInferenceEngine(makeConfig(own, opponent), Seat.South);

    // Should not throw
    expect(() => engine.processBid(bid1NT(), emptyAuction)).not.toThrow();

    // Beliefs should still be wide-open defaults
    const result = engine.getBeliefs();
    expect(result[Seat.North].ranges.hcp.min).toBe(0);
  });

  it("timeline records snapshots after each processBid", () => {
    const inference: HandInference = { seat: Seat.North, source: "test", minHcp: 12, suits: {} };
    const own = makeProvider(inference);
    const opponent = makeProvider();
    const engine = createInferenceEngine(makeConfig(own, opponent), Seat.South);

    expect(engine.getTimeline()).toHaveLength(0);

    const entry = bid1NT();
    engine.processBid(entry, emptyAuction);

    const timeline = engine.getTimeline();
    expect(timeline).toHaveLength(1);
    expect(timeline[0]!.entry).toBe(entry);
    expect(timeline[0]!.newConstraints).toEqual([
      { factId: "hand.hcp", operator: FactOperator.Gte, value: 12 },
    ]);
    expect(timeline[0]!.cumulativeBeliefs[Seat.North].ranges.hcp.min).toBe(12);
  });

  it("timeline records snapshot even when inference is null", () => {
    const own = makeProvider(null);
    const opponent = makeProvider();
    const engine = createInferenceEngine(makeConfig(own, opponent), Seat.South);

    engine.processBid(bid1NT(), emptyAuction);

    const timeline = engine.getTimeline();
    expect(timeline).toHaveLength(1);
    expect(timeline[0]!.newConstraints).toEqual([]);
  });

  it("timeline records snapshot even when provider throws", () => {
    const own = makeThrowingProvider();
    const opponent = makeProvider();
    const engine = createInferenceEngine(makeConfig(own, opponent), Seat.South);

    engine.processBid(bid1NT(), emptyAuction);

    const timeline = engine.getTimeline();
    expect(timeline).toHaveLength(1);
    expect(timeline[0]!.newConstraints).toEqual([]);
  });

  it("reset clears all accumulated constraints and timeline", () => {
    const inference: HandInference = { seat: Seat.North, source: "test", minHcp: 15, maxHcp: 17, suits: {} };
    const own = makeProvider(inference);
    const opponent = makeProvider();
    const engine = createInferenceEngine(makeConfig(own, opponent), Seat.South);

    engine.processBid(bid1NT(), emptyAuction);
    expect(engine.getTimeline()).toHaveLength(1);
    expect(engine.getBeliefs()[Seat.North].ranges.hcp.min).toBe(15);

    engine.reset();

    expect(engine.getTimeline()).toHaveLength(0);
    expect(engine.getBeliefs()[Seat.North].ranges.hcp.min).toBe(0);
    expect(engine.getBeliefs()[Seat.North].ranges.hcp.max).toBe(40);
  });

  it("processes multiple bids and narrows beliefs", () => {
    let callCount = 0;
    const narrowingProvider: InferenceProvider = {
      id: "narrowing",
      name: "narrowing",
      inferFromBid() {
        callCount++;
        if (callCount === 1) return { seat: Seat.North, source: "test", minHcp: 12, suits: {} };
        return { seat: Seat.North, source: "test", minHcp: 15, maxHcp: 17, suits: {} };
      },
    };
    const opponent = makeProvider();
    const engine = createInferenceEngine(makeConfig(narrowingProvider, opponent), Seat.South);

    engine.processBid(bid1NT(), emptyAuction);
    const auction1: Auction = { entries: [bid1NT()], isComplete: false };
    engine.processBid(passEntry(Seat.North), auction1);

    // North should have min=15 (max of 12, 15) and max=17
    const result = engine.getBeliefs();
    expect(result[Seat.North].ranges.hcp.min).toBe(15);
    expect(result[Seat.North].ranges.hcp.max).toBe(17);
    expect(engine.getTimeline()).toHaveLength(2);
  });
});
