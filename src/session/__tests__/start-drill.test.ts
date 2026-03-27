import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startDrill,
  rotateSeat180,
  rotateDealConstraints,
  rotateAuction,
  pickVulnerability,
} from "../start-drill";
import {
  createStubEngine,
  makeDeal,
} from "../../test-support/engine-stub";
import { Seat, Vulnerability } from "../../engine/types";
import type { DealConstraints, SeatConstraint } from "../../engine/types";
import { clearBundleRegistry, registerBundle, createConventionConfigFromBundle, ntBundle, ConventionCategory } from "../../conventions";
import type { ConventionConfig } from "../../conventions";
import { buildAuction } from "../../engine/auction-helpers";

const ntBundleConventionConfig = createConventionConfigFromBundle(ntBundle);

describe("startDrill", () => {
  beforeEach(() => {
    clearBundleRegistry();
    registerBundle(ntBundle);
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
    ).rejects.toThrowError(/No bundle registered/);
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

describe("pickVulnerability", () => {
  const equal = { none: 1, ours: 1, theirs: 1, both: 1 };

  it("returns None for roll in first quarter", () => {
    expect(pickVulnerability(equal, Seat.South, 0.0)).toBe(Vulnerability.None);
    expect(pickVulnerability(equal, Seat.South, 0.24)).toBe(Vulnerability.None);
  });

  it("returns ours (NorthSouth for South user) for roll in second quarter", () => {
    expect(pickVulnerability(equal, Seat.South, 0.26)).toBe(Vulnerability.NorthSouth);
    expect(pickVulnerability(equal, Seat.North, 0.26)).toBe(Vulnerability.NorthSouth);
  });

  it("returns theirs (EastWest for South user) for roll in third quarter", () => {
    expect(pickVulnerability(equal, Seat.South, 0.51)).toBe(Vulnerability.EastWest);
    expect(pickVulnerability(equal, Seat.North, 0.51)).toBe(Vulnerability.EastWest);
  });

  it("returns Both for roll in last quarter", () => {
    expect(pickVulnerability(equal, Seat.South, 0.76)).toBe(Vulnerability.Both);
    expect(pickVulnerability(equal, Seat.South, 0.99)).toBe(Vulnerability.Both);
  });

  it("flips ours/theirs for East user seat", () => {
    // For East user, "ours" = EastWest, "theirs" = NorthSouth
    expect(pickVulnerability(equal, Seat.East, 0.26)).toBe(Vulnerability.EastWest);
    expect(pickVulnerability(equal, Seat.East, 0.51)).toBe(Vulnerability.NorthSouth);
  });

  it("respects unequal weights", () => {
    // Only "both" has weight → always Both
    const allBoth = { none: 0, ours: 0, theirs: 0, both: 1 };
    expect(pickVulnerability(allBoth, Seat.South, 0.0)).toBe(Vulnerability.Both);
    expect(pickVulnerability(allBoth, Seat.South, 0.99)).toBe(Vulnerability.Both);
  });

  it("returns None for zero-weight distribution", () => {
    const empty = { none: 0, ours: 0, theirs: 0, both: 0 };
    expect(pickVulnerability(empty, Seat.South, 0.5)).toBe(Vulnerability.None);
  });
});

describe("startDrill practiceRole", () => {
  beforeEach(() => {
    clearBundleRegistry();
    registerBundle(ntBundle);
  });

  it("defaults to responder when no role specified", async () => {
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(makeDeal()),
    });

    const bundle = await startDrill(engine, ntBundleConventionConfig, Seat.South);

    expect(bundle.resolvedRole).toBe("responder");
  });

  it("swaps constraints so South is dealer when role is opener", async () => {
    const generateDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal });

    const bundle = await startDrill(engine, ntBundleConventionConfig, Seat.South, undefined, undefined, {
      practiceRole: "opener",
    });

    expect(bundle.resolvedRole).toBe("opener");
    // Deal constraints should have South as dealer (opener)
    const constraints = generateDeal.mock.calls[0]![0] as DealConstraints;
    expect(constraints.dealer).toBe(Seat.South);
    // South should have the opener's hand constraints (15-17 HCP balanced for 1NT)
    const southConstraints = constraints.seats.filter((s: SeatConstraint) => s.seat === Seat.South);
    expect(southConstraints.length).toBeGreaterThan(0);
    expect(southConstraints[0]!.minHcp).toBe(15);
  });

  it("skips initial auction for opener mode", async () => {
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(makeDeal()),
    });

    const bundle = await startDrill(engine, ntBundleConventionConfig, Seat.South, undefined, undefined, {
      practiceRole: "opener",
    });

    expect(bundle.initialAuction).toBeUndefined();
  });

  it("resolves 'both' using seeded RNG for deterministic results", async () => {
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(makeDeal()),
    });

    // RNG returns < 0.5 → opener
    const bundle1 = await startDrill(engine, ntBundleConventionConfig, Seat.South, () => 0.3, undefined, {
      practiceRole: "both",
    });
    expect(bundle1.resolvedRole).toBe("opener");

    // RNG returns >= 0.5 → responder
    const bundle2 = await startDrill(engine, ntBundleConventionConfig, Seat.South, () => 0.7, undefined, {
      practiceRole: "both",
    });
    expect(bundle2.resolvedRole).toBe("responder");
  });

  it("coerces opener role to responder for opponent conventions", async () => {
    // Register DONT bundle (opponent convention)
    const { dontBundle } = await import("../../conventions/definitions/dont-bundle");
    clearBundleRegistry();
    registerBundle(ntBundle);
    registerBundle(dontBundle);
    const dontConfig = createConventionConfigFromBundle(dontBundle);

    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(makeDeal()),
    });

    const bundle = await startDrill(engine, dontConfig, Seat.South, undefined, undefined, {
      practiceRole: "opener",
    });

    // Should be coerced to responder since DONT is an opponent convention
    expect(bundle.resolvedRole).toBe("responder");
  });
});

describe("startDrill vulnerability", () => {
  beforeEach(() => {
    clearBundleRegistry();
    registerBundle(ntBundle);
  });

  it("assigns vulnerability from tuning distribution to generated deal", async () => {
    const generateDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal });

    // RNG: first call for dealer (not used — no allowedDealers), second for vulnerability
    let callCount = 0;
    const rng = () => {
      callCount++;
      return 0.76; // → Both in equal distribution
    };

    await startDrill(engine, ntBundleConventionConfig, Seat.South, rng, undefined, {
      tuning: {
        vulnerabilityDistribution: { none: 1, ours: 1, theirs: 1, both: 1 },
      },
    });

    const constraints = generateDeal.mock.calls[0]![0] as DealConstraints;
    expect(constraints.vulnerability).toBe(Vulnerability.Both);
  });

  it("uses default none-only distribution when no tuning provided", async () => {
    const generateDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal });

    // Default distribution is none-only, so any RNG value yields None
    await startDrill(engine, ntBundleConventionConfig, Seat.South, () => 0.1);

    const constraints = generateDeal.mock.calls[0]![0] as DealConstraints;
    expect(constraints.vulnerability).toBe(Vulnerability.None);
  });

  it("respects custom tuning override", async () => {
    const generateDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal });

    await startDrill(engine, ntBundleConventionConfig, Seat.South, () => 0.5, undefined, {
      tuning: {
        vulnerabilityDistribution: { none: 0, ours: 0, theirs: 0, both: 1 },
      },
    });

    const constraints = generateDeal.mock.calls[0]![0] as DealConstraints;
    expect(constraints.vulnerability).toBe(Vulnerability.Both);
  });
});
