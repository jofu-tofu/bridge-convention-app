import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startDrill,
  buildOpponentPassConstraints,
  rotateSeat180,
  rotateDealConstraints,
  rotateAuction,
} from "../helpers";
import {
  createStubEngine,
  makeDeal,
} from "../../test-support/engine-stub";
import { Seat } from "../../engine/types";
import type { SeatConstraint, DealConstraints } from "../../engine/types";
import { clearRegistry, registerConvention } from "../../conventions/core/registry";
import { staymanConfig } from "../../conventions/definitions/stayman";
import { saycConfig } from "../../conventions/definitions/sayc";
import { dontConfig } from "../../conventions/definitions/dont";
import { conventionToStrategy } from "../../strategy/bidding/convention-strategy";
import { buildAuction } from "../../engine/auction-helpers";
import { parseHand } from "../../engine/notation";
import type { ConventionConfig } from "../../conventions/core/types";

describe("buildOpponentPassConstraints", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(saycConfig);
  });

  const saycStrategy = () => conventionToStrategy(saycConfig);

  it("returns empty array when defaultAuction is undefined", () => {
    const result = buildOpponentPassConstraints(undefined, saycStrategy());
    expect(result).toEqual([]);
  });

  it("returns empty array when auction has no E/W passes", () => {
    // DONT-like: East opens 1NT, no pass entries from E/W
    const auction = buildAuction(Seat.East, ["1NT"]);
    const result = buildOpponentPassConstraints(auction, saycStrategy());
    expect(result).toEqual([]);
  });

  it("returns SeatConstraint for East when auction has East pass", () => {
    // Stayman: North opens 1NT, East passes
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = buildOpponentPassConstraints(auction, saycStrategy());
    expect(result).toHaveLength(1);
    expect(result[0]!.seat).toBe(Seat.East);
    expect(typeof result[0]!.customCheck).toBe("function");
  });

  it("rejects hands where SAYC would overcall after 1NT", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const constraints = buildOpponentPassConstraints(auction, saycStrategy());
    const check = constraints[0]!.customCheck!;

    // Strong hand: 14 HCP, 5-card spade suit — SAYC overcalls 1-level
    // SA SK SJ S9 S4 . HK H3 H2 . DQ D7 D5 . C8 C2
    const strongHand = parseHand([
      "SA", "SK", "SJ", "S9", "S4",
      "HK", "H3", "H2",
      "DQ", "D7", "D5",
      "C8", "C2",
    ]);
    expect(check(strongHand)).toBe(false);
  });

  it("accepts hands where SAYC would pass after 1NT", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const constraints = buildOpponentPassConstraints(auction, saycStrategy());
    const check = constraints[0]!.customCheck!;

    // Weak hand: 7 HCP, no good suit — SAYC passes
    // SJ S8 S3 S2 . H9 H5 H4 . DK D7 D2 . CQ C8 C6
    const weakHand = parseHand([
      "SJ", "S8", "S3", "S2",
      "H9", "H5", "H4",
      "DK", "D7", "D2",
      "CQ", "C8", "C6",
    ]);
    expect(check(weakHand)).toBe(true);
  });
});

describe("startDrill", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
    registerConvention(saycConfig);
  });

  it("includes opponent pass constraints in generateDeal call", async () => {
    const generateDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    await startDrill(engine, staymanConfig, Seat.South, gameStore);

    const constraints = generateDeal.mock.calls[0]![0];
    // Stayman has defaultAuction with East pass, so seats should include
    // the convention's own constraints PLUS the opponent pass constraint
    expect(constraints.seats.length).toBeGreaterThan(
      staymanConfig.dealConstraints.seats.length,
    );
    const eastConstraint = constraints.seats.find(
      (s: SeatConstraint) => s.seat === Seat.East,
    );
    expect(eastConstraint).toBeDefined();
    expect(typeof eastConstraint!.customCheck).toBe("function");
  });

  it("calls gameStore.startDrill with generated deal and session", async () => {
    const deal = makeDeal();
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(deal),
    });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    await startDrill(engine, staymanConfig, Seat.South, gameStore);

    expect(gameStore.startDrill).toHaveBeenCalledTimes(1);
    const [calledDeal, calledSession] = gameStore.startDrill.mock.calls[0]!;
    expect(calledDeal).toBe(deal);
    expect(calledSession).toBeDefined();
    expect(typeof calledSession.getNextBid).toBe("function");
  });

  it("passes initialAuction from convention.defaultAuction when defined", async () => {
    const deal = makeDeal();
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(deal),
    });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    // Create a test convention with a defaultAuction that has no E/W passes
    const mockAuction = { entries: [], isComplete: false };
    const conventionWithDefault = {
      ...staymanConfig,
      defaultAuction: vi.fn().mockReturnValue(mockAuction),
    };

    await startDrill(engine, conventionWithDefault, Seat.South, gameStore);

    expect(conventionWithDefault.defaultAuction).toHaveBeenCalledWith(
      Seat.South,
      deal,
    );
    const [, , calledAuction] = gameStore.startDrill.mock.calls[0]!;
    expect(calledAuction).toBe(mockAuction);
  });

  it("passes undefined initialAuction when convention has no defaultAuction", async () => {
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(makeDeal()),
    });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    // Create convention without defaultAuction
    const { defaultAuction: _, ...conventionNoDefault } = staymanConfig;
    registerConvention({ ...conventionNoDefault, id: "stayman-no-default" });
    const config = {
      ...conventionNoDefault,
      id: "stayman-no-default",
    } as typeof staymanConfig;

    await startDrill(engine, config, Seat.South, gameStore);

    const [, , calledAuction] = gameStore.startDrill.mock.calls[0]!;
    expect(calledAuction).toBeUndefined();
  });

  it("does not add opponent constraints when convention has no defaultAuction", async () => {
    const generateDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    const { defaultAuction: _, ...conventionNoDefault } = staymanConfig;
    const config = {
      ...conventionNoDefault,
      id: "stayman-no-default",
    } as typeof staymanConfig;
    registerConvention(config);

    await startDrill(engine, config, Seat.South, gameStore);

    const constraints = generateDeal.mock.calls[0]![0];
    // Without defaultAuction, seats should match convention's own constraints exactly
    expect(constraints.seats).toEqual(config.dealConstraints.seats);
  });

  it("rotates constraints when allowedDealers picks a different dealer", async () => {
    registerConvention(dontConfig);
    const generateDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    // RNG returns 0.7 → floor(0.7 * 2) = 1 → picks West (second element)
    const convention: ConventionConfig = {
      ...dontConfig,
      allowedDealers: [Seat.East, Seat.West],
    };

    await startDrill(engine, convention, Seat.South, gameStore, () => 0.7);

    const constraints = generateDeal.mock.calls[0]![0] as DealConstraints;
    expect(constraints.dealer).toBe(Seat.West);
    // East seat constraints should have been rotated to West
    const westConstraints = constraints.seats.filter(
      (s: SeatConstraint) => s.seat === Seat.West,
    );
    expect(westConstraints.length).toBeGreaterThan(0);
  });

  it("does not rotate when allowedDealers picks the base dealer", async () => {
    registerConvention(dontConfig);
    const generateDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    // RNG returns 0.3 → floor(0.3 * 2) = 0 → picks East (first element, same as base)
    const convention: ConventionConfig = {
      ...dontConfig,
      allowedDealers: [Seat.East, Seat.West],
    };

    await startDrill(engine, convention, Seat.South, gameStore, () => 0.3);

    const constraints = generateDeal.mock.calls[0]![0] as DealConstraints;
    expect(constraints.dealer).toBe(Seat.East);
  });

  it("uses base constraints when allowedDealers is not set", async () => {
    const generateDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    await startDrill(engine, staymanConfig, Seat.South, gameStore);

    const constraints = generateDeal.mock.calls[0]![0] as DealConstraints;
    // Stayman base dealer is North (from dealConstraints)
    expect(constraints.dealer).toBe(staymanConfig.dealConstraints.dealer);
  });

  it("rotates initialAuction entries when dealer was rotated", async () => {
    registerConvention(dontConfig);
    const deal = makeDeal();
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(deal),
    });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    const convention: ConventionConfig = {
      ...dontConfig,
      allowedDealers: [Seat.East, Seat.West],
    };

    // RNG picks West
    await startDrill(engine, convention, Seat.South, gameStore, () => 0.7);

    const [, , calledAuction] = gameStore.startDrill.mock.calls[0]!;
    // DONT defaultAuction normally starts from East with "1NT"
    // After rotation, the entry should be from West
    expect(calledAuction).toBeDefined();
    expect(calledAuction.entries[0].seat).toBe(Seat.West);
  });
});

describe("rotateSeat180", () => {
  it("swaps North and South", () => {
    expect(rotateSeat180(Seat.North)).toBe(Seat.South);
    expect(rotateSeat180(Seat.South)).toBe(Seat.North);
  });

  it("swaps East and West", () => {
    expect(rotateSeat180(Seat.East)).toBe(Seat.West);
    expect(rotateSeat180(Seat.West)).toBe(Seat.East);
  });
});

describe("rotateDealConstraints", () => {
  it("returns base unchanged when newDealer matches base dealer", () => {
    const base: DealConstraints = {
      dealer: Seat.East,
      seats: [{ seat: Seat.East, minHcp: 15 }],
    };
    const result = rotateDealConstraints(base, Seat.East);
    expect(result).toBe(base);
  });

  it("rotates seats and dealer by 180°", () => {
    const base: DealConstraints = {
      dealer: Seat.East,
      seats: [
        { seat: Seat.East, minHcp: 15 },
        { seat: Seat.South, minHcp: 10 },
      ],
    };
    const result = rotateDealConstraints(base, Seat.West);
    expect(result.dealer).toBe(Seat.West);
    expect(result.seats).toEqual([
      { seat: Seat.West, minHcp: 15 },
      { seat: Seat.North, minHcp: 10 },
    ]);
  });

  it("returns base unchanged when dealer is undefined", () => {
    const base: DealConstraints = {
      seats: [{ seat: Seat.East, minHcp: 15 }],
    };
    const result = rotateDealConstraints(base, Seat.West);
    expect(result).toBe(base);
  });
});

describe("rotateAuction", () => {
  it("rotates all auction entry seats by 180°", () => {
    const auction = buildAuction(Seat.East, ["1NT"]);
    const result = rotateAuction(auction);
    expect(result.entries[0]!.seat).toBe(Seat.West);
    expect(result.entries[0]!.call).toEqual(auction.entries[0]!.call);
    expect(result.isComplete).toBe(auction.isComplete);
  });

  it("rotates multi-entry auctions", () => {
    const auction = buildAuction(Seat.East, ["1NT", "P"]);
    const result = rotateAuction(auction);
    expect(result.entries[0]!.seat).toBe(Seat.West);
    expect(result.entries[1]!.seat).toBe(Seat.North);
  });
});
