import { describe, it, expect, beforeEach } from "vitest";
import {
  createInferenceEngine,
  createNaturalInferenceProvider,
  createConventionInferenceProvider,
} from "../index";
import type { InferenceConfig, InferenceProvider } from "../index";
import { Seat, BidSuit } from "../../../engine/types";
import type { AuctionEntry, Auction } from "../../../engine/types";
import {
  registerConvention,
  clearRegistry,
} from "../../../conventions/registry";
import { staymanConfig } from "../../../conventions/stayman";
import { saycConfig } from "../../../conventions/sayc";

function makeEntry(seat: Seat, call: AuctionEntry["call"]): AuctionEntry {
  return { seat, call };
}

const emptyAuction: Auction = { entries: [], isComplete: false };

function buildAuction(...entries: AuctionEntry[]): Auction {
  return { entries, isComplete: false };
}

describe("InferenceEngine timeline", () => {
  let config: InferenceConfig;

  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
    registerConvention(saycConfig);

    config = {
      ownPartnership: createConventionInferenceProvider("stayman"),
      opponentPartnership: createNaturalInferenceProvider(),
    };
  });

  it("after N bids processed, getTimeline() has N entries", () => {
    const engine = createInferenceEngine(config, Seat.South);

    const e1 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.NoTrump,
    });
    engine.processBid(e1, emptyAuction);

    const e2 = makeEntry(Seat.East, { type: "pass" });
    engine.processBid(e2, buildAuction(e1));

    const e3 = makeEntry(Seat.South, {
      type: "bid",
      level: 2,
      strain: BidSuit.Clubs,
    });
    engine.processBid(e3, buildAuction(e1, e2));

    expect(engine.getTimeline()).toHaveLength(3);
  });

  it("each snapshot has entry matching the bid processed", () => {
    const engine = createInferenceEngine(config, Seat.South);

    const e1 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.NoTrump,
    });
    engine.processBid(e1, emptyAuction);

    const timeline = engine.getTimeline();
    expect(timeline[0]!.entry).toBe(e1);
  });

  it("cumulativeInferences contain all four seats", () => {
    const engine = createInferenceEngine(config, Seat.South);

    const e1 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.NoTrump,
    });
    engine.processBid(e1, emptyAuction);

    const snapshot = engine.getTimeline()[0]!;
    // All four seats present in cumulative inferences
    expect(snapshot.cumulativeInferences[Seat.North]).toBeDefined();
    expect(snapshot.cumulativeInferences[Seat.East]).toBeDefined();
    expect(snapshot.cumulativeInferences[Seat.South]).toBeDefined();
    expect(snapshot.cumulativeInferences[Seat.West]).toBeDefined();
  });

  it("reset() clears timeline", () => {
    const engine = createInferenceEngine(config, Seat.South);

    const e1 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.NoTrump,
    });
    engine.processBid(e1, emptyAuction);
    expect(engine.getTimeline()).toHaveLength(1);

    engine.reset();
    expect(engine.getTimeline()).toHaveLength(0);
  });

  it("timeline entry captured even when inference provider throws", () => {
    const throwingProvider: InferenceProvider = {
      id: "throwing",
      name: "Throwing",
      inferFromBid() {
        throw new Error("boom");
      },
    };

    const throwConfig: InferenceConfig = {
      ownPartnership: throwingProvider,
      opponentPartnership: throwingProvider,
    };

    const engine = createInferenceEngine(throwConfig, Seat.South);
    const e1 = makeEntry(Seat.North, {
      type: "bid",
      level: 1,
      strain: BidSuit.NoTrump,
    });
    engine.processBid(e1, emptyAuction);

    const timeline = engine.getTimeline();
    expect(timeline).toHaveLength(1);
    expect(timeline[0]!.entry).toBe(e1);
    expect(timeline[0]!.newInference).toBeNull();
  });
});
