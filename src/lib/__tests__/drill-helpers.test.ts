import { describe, it, expect, vi, beforeEach } from "vitest";
import { startDrill, buildOpponentPassConstraints } from "../drill-helpers";
import {
  createStubEngine,
  makeDeal,
} from "../../components/__tests__/test-helpers";
import { Seat } from "../../engine/types";
import type { SeatConstraint } from "../../engine/types";
import { clearRegistry, registerConvention } from "../../conventions/registry";
import { staymanConfig } from "../../conventions/stayman";
import { saycConfig } from "../../conventions/sayc";
import { conventionToStrategy } from "../../ai/convention-strategy";
import { buildAuction } from "../../engine/auction-helpers";
import { parseHand } from "../../engine/notation";

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
});
