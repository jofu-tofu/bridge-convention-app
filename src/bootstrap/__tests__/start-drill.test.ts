import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startDrill,
  rotateSeat180,
  rotateDealConstraints,
  rotateAuction,
} from "../start-drill";
import {
  createStubEngine,
  makeDeal,
} from "../../test-support/engine-stub";
import { Seat } from "../../engine/types";
import type { DealConstraints, SeatConstraint } from "../../engine/types";
import { clearRegistry, registerConvention } from "../../conventions/core/registry";
import { ntBundleConventionConfig } from "../../conventions/definitions/nt-bundle/convention-config";
import { buildAuction } from "../../engine/auction-helpers";
import { ConventionCategory } from "../../conventions/core/types";
import type { ConventionConfig } from "../../conventions/core/types";

describe("startDrill", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(ntBundleConventionConfig);
  });

  it("returns bundle with generated deal and session", async () => {
    const deal = makeDeal();
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(deal),
    });

    const bundle = await startDrill(engine, ntBundleConventionConfig, Seat.South);

    expect(bundle.deal).toBe(deal);
    expect(bundle.session).toBeDefined();
    expect(typeof bundle.session.getNextBid).toBe("function");
  });

  it("includes initialAuction from convention.defaultAuction when defined", async () => {
    const deal = makeDeal();
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(deal),
    });

    // Create a test convention with a defaultAuction that has no E/W passes
    const mockAuction = { entries: [], isComplete: false };
    const conventionWithDefault: ConventionConfig = {
      ...ntBundleConventionConfig,
      defaultAuction: vi.fn().mockReturnValue(mockAuction),
    };

    const bundle = await startDrill(engine, conventionWithDefault, Seat.South);

    expect(conventionWithDefault.defaultAuction).toHaveBeenCalledWith(
      Seat.South,
      deal,
    );
    expect(bundle.initialAuction).toBe(mockAuction);
  });

  it("returns undefined initialAuction when convention has no defaultAuction", async () => {
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(makeDeal()),
    });

    // Create convention without defaultAuction
    const { defaultAuction: _, ...conventionNoDefault } = ntBundleConventionConfig;
    const config: ConventionConfig = {
      ...conventionNoDefault,
      id: "nt-bundle",
    };

    const bundle = await startDrill(engine, config, Seat.South);

    expect(bundle.initialAuction).toBeUndefined();
  });

  it("passes convention constraints directly to generateDeal", async () => {
    const generateDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal });

    const { defaultAuction: _, ...conventionNoDefault } = ntBundleConventionConfig;
    const config: ConventionConfig = {
      ...conventionNoDefault,
      id: "nt-bundle",
    };

    await startDrill(engine, config, Seat.South);

    const constraints = generateDeal.mock.calls[0]![0];
    expect(constraints.seats).toEqual(config.dealConstraints.seats);
  });

  it("throws when no ConventionSpec is registered for the convention", async () => {
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(makeDeal()),
    });

    // Use a convention ID that has no ConventionSpec registered
    const unknownConvention: ConventionConfig = {
      ...ntBundleConventionConfig,
      id: "unknown-convention",
    };

    await expect(
      startDrill(engine, unknownConvention, Seat.South),
    ).rejects.toThrowError(/No ConventionSpec registered/);
  });

  it("rotates constraints when allowedDealers picks a different dealer", async () => {
    // Synthetic convention with East-based constraints and allowedDealers
    const rotationConvention: ConventionConfig = {
      id: "nt-bundle",
      name: "Rotation Test",
      description: "Test rotation",
      category: ConventionCategory.Competitive,
      dealConstraints: {
        dealer: Seat.East,
        seats: [{ seat: Seat.East, minHcp: 15 }],
      },
      allowedDealers: [Seat.East, Seat.West],
      defaultAuction: () => buildAuction(Seat.East, ["1NT"]),
    };
    const generateDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal });

    // RNG returns 0.7 → floor(0.7 * 2) = 1 → picks West (second element)
    await startDrill(engine, rotationConvention, Seat.South, () => 0.7);

    const constraints = generateDeal.mock.calls[0]![0] as DealConstraints;
    expect(constraints.dealer).toBe(Seat.West);
    // East seat constraints should have been rotated to West
    const westConstraints = constraints.seats.filter(
      (s: SeatConstraint) => s.seat === Seat.West,
    );
    expect(westConstraints.length).toBeGreaterThan(0);
  });

  it("does not rotate when allowedDealers picks the base dealer", async () => {
    const rotationConvention: ConventionConfig = {
      id: "nt-bundle",
      name: "Rotation Test 2",
      description: "Test rotation",
      category: ConventionCategory.Competitive,
      dealConstraints: {
        dealer: Seat.East,
        seats: [{ seat: Seat.East, minHcp: 15 }],
      },
      allowedDealers: [Seat.East, Seat.West],
      defaultAuction: () => buildAuction(Seat.East, ["1NT"]),
    };
    const generateDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal });

    // RNG returns 0.3 → floor(0.3 * 2) = 0 → picks East (first element, same as base)
    await startDrill(engine, rotationConvention, Seat.South, () => 0.3);

    const constraints = generateDeal.mock.calls[0]![0] as DealConstraints;
    expect(constraints.dealer).toBe(Seat.East);
  });

  it("uses base constraints when allowedDealers is not set", async () => {
    const generateDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal });

    await startDrill(engine, ntBundleConventionConfig, Seat.South);

    const constraints = generateDeal.mock.calls[0]![0] as DealConstraints;
    // ntBundle base dealer is North (from dealConstraints)
    expect(constraints.dealer).toBe(ntBundleConventionConfig.dealConstraints.dealer);
  });

  it("rotates initialAuction entries when dealer was rotated", async () => {
    const rotationConvention: ConventionConfig = {
      id: "nt-bundle",
      name: "Rotation Test 3",
      description: "Test rotation",
      category: ConventionCategory.Competitive,
      dealConstraints: {
        dealer: Seat.East,
        seats: [{ seat: Seat.East, minHcp: 15 }],
      },
      allowedDealers: [Seat.East, Seat.West],
      defaultAuction: () => buildAuction(Seat.East, ["1NT"]),
    };
    const deal = makeDeal();
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(deal),
    });

    // RNG picks West
    const bundle = await startDrill(engine, rotationConvention, Seat.South, () => 0.7);

    // defaultAuction normally starts from East with "1NT"
    // After rotation, the entry should be from West
    expect(bundle.initialAuction).toBeDefined();
    expect(bundle.initialAuction!.entries[0]!.seat).toBe(Seat.West);
  });

  it("returns inference engines in the bundle", async () => {
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(makeDeal()),
    });

    const bundle = await startDrill(engine, ntBundleConventionConfig, Seat.South);

    expect(bundle.nsInferenceEngine).not.toBeNull();
    expect(bundle.ewInferenceEngine).not.toBeNull();
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
