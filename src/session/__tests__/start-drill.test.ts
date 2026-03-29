import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startDrill,
  rotateSeat180,
  rotateDealConstraints,
  rotateAuction,
  pickVulnerability,
} from "../start-drill";
import { Seat, Vulnerability } from "../../engine/types";
import type { DealConstraints } from "../../engine/types";
import { calculateHcp } from "../../engine/hand-evaluator";
import { clearBundleRegistry, registerBundle, createConventionConfigFromBundle, ntBundle, ConventionCategory } from "../../conventions";
import type { ConventionConfig } from "../../conventions";
import { buildAuction } from "../../engine/auction-helpers";
import { mulberry32 } from "../../engine/seeded-rng";
import { PracticeRole } from "../drill-types";

const ntBundleConventionConfig = createConventionConfigFromBundle(ntBundle);

/** Returns specific values for pre-deal decisions, then delegates to a proper PRNG for deal generation. */
function testRng(...preValues: number[]): () => number {
  let i = 0;
  const fallback = mulberry32(12345);
  return () => i < preValues.length ? preValues[i++]! : fallback();
}

describe("startDrill", () => {
  beforeEach(() => {
    clearBundleRegistry();
    registerBundle(ntBundle);
  });

  it("returns bundle with generated deal and session", async () => {
    const bundle = await startDrill(ntBundleConventionConfig, Seat.South);

    // TS generator produces valid 4×13 deal
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      expect(bundle.deal.hands[seat].cards).toHaveLength(13);
    }
    expect(bundle.session).toBeDefined();
    expect(typeof bundle.session.getNextBid).toBe("function");
  });

  it("includes initialAuction from convention.defaultAuction when defined", async () => {
    const mockAuction = { entries: [], isComplete: false };
    const conventionWithDefault: ConventionConfig = {
      ...ntBundleConventionConfig,
      defaultAuction: vi.fn().mockReturnValue(mockAuction),
    };

    const bundle = await startDrill(conventionWithDefault, Seat.South);

    expect(conventionWithDefault.defaultAuction).toHaveBeenCalledWith(
      Seat.South,
      bundle.deal,
    );
    expect(bundle.initialAuction).toBe(mockAuction);
  });

  it("returns undefined initialAuction when convention has no defaultAuction", async () => {
    const { defaultAuction: _, ...conventionNoDefault } = ntBundleConventionConfig;
    const config: ConventionConfig = {
      ...conventionNoDefault,
      id: "nt-bundle",
    };

    const bundle = await startDrill(config, Seat.South);

    expect(bundle.initialAuction).toBeUndefined();
  });

  it("passes convention constraints directly — deal satisfies HCP envelope", async () => {
    const { defaultAuction: _, ...conventionNoDefault } = ntBundleConventionConfig;
    const config: ConventionConfig = {
      ...conventionNoDefault,
      id: "nt-bundle",
    };

    const bundle = await startDrill(config, Seat.South);

    // NT bundle requires North: 15-17 HCP
    const northHcp = calculateHcp(bundle.deal.hands[Seat.North]);
    expect(northHcp).toBeGreaterThanOrEqual(15);
    expect(northHcp).toBeLessThanOrEqual(17);
  });

  it("throws when no ConventionSpec is registered for the convention", () => {
    const unknownConvention: ConventionConfig = {
      ...ntBundleConventionConfig,
      id: "unknown-convention",
    };

    expect(() =>
      startDrill(unknownConvention, Seat.South),
    ).toThrowError(/No bundle registered/);
  });

  it("rotates constraints when allowedDealers picks a different dealer", async () => {
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

    // RNG: first call 0.7 → floor(0.7 * 2) = 1 → picks West (second element)
    const bundle = await startDrill(rotationConvention, Seat.South, testRng(0.7));

    expect(bundle.deal.dealer).toBe(Seat.West);
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

    // RNG: first call 0.3 → floor(0.3 * 2) = 0 → picks East (first element, same as base)
    const bundle = await startDrill(rotationConvention, Seat.South, testRng(0.3));

    expect(bundle.deal.dealer).toBe(Seat.East);
  });

  it("uses base constraints when allowedDealers is not set", async () => {
    const bundle = await startDrill(ntBundleConventionConfig, Seat.South);

    // NT bundle has no explicit dealer — TS generator defaults to North
    const expectedDealer = ntBundleConventionConfig.dealConstraints.dealer ?? Seat.North;
    expect(bundle.deal.dealer).toBe(expectedDealer);
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

    // RNG: first call picks West
    const bundle = await startDrill(rotationConvention, Seat.South, testRng(0.7));

    // defaultAuction normally starts from East with "1NT"
    // After rotation, the entry should be from West
    expect(bundle.initialAuction).toBeDefined();
    expect(bundle.initialAuction!.entries[0]!.seat).toBe(Seat.West);
  });

  it("returns inference engines in the bundle", async () => {
    const bundle = await startDrill(ntBundleConventionConfig, Seat.South);

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
    const bundle = await startDrill(ntBundleConventionConfig, Seat.South);

    expect(bundle.resolvedRole).toBe(PracticeRole.Responder);
  });

  it("swaps constraints so South is dealer when role is opener", async () => {
    const bundle = await startDrill(ntBundleConventionConfig, Seat.South, undefined, undefined, {
      practiceRole: PracticeRole.Opener,
    });

    expect(bundle.resolvedRole).toBe(PracticeRole.Opener);
    // Deal should have South as dealer (opener)
    expect(bundle.deal.dealer).toBe(Seat.South);
    // South should have the opener's hand (15-17 HCP for 1NT)
    const southHcp = calculateHcp(bundle.deal.hands[Seat.South]);
    expect(southHcp).toBeGreaterThanOrEqual(15);
    expect(southHcp).toBeLessThanOrEqual(17);
  });

  it("skips initial auction for opener mode", async () => {
    const bundle = await startDrill(ntBundleConventionConfig, Seat.South, undefined, undefined, {
      practiceRole: PracticeRole.Opener,
    });

    expect(bundle.initialAuction).toBeUndefined();
  });

  it("resolves 'both' using seeded RNG for deterministic results", async () => {
    // RNG: first call < 0.5 → opener (role), rest for deal gen
    const bundle1 = await startDrill(ntBundleConventionConfig, Seat.South, testRng(0.3), undefined, {
      practiceRole: PracticeRole.Both,
    });
    expect(bundle1.resolvedRole).toBe(PracticeRole.Opener);

    // RNG: first call >= 0.5 → responder (role), rest for deal gen
    const bundle2 = await startDrill(ntBundleConventionConfig, Seat.South, testRng(0.7), undefined, {
      practiceRole: PracticeRole.Both,
    });
    expect(bundle2.resolvedRole).toBe(PracticeRole.Responder);
  });

  it("coerces opener role to responder for opponent conventions", async () => {
    // Register DONT bundle (opponent convention)
    const { dontBundle } = await import("../../conventions/definitions/dont-bundle");
    clearBundleRegistry();
    registerBundle(ntBundle);
    registerBundle(dontBundle);
    const dontConfig = createConventionConfigFromBundle(dontBundle);

    const bundle = await startDrill(dontConfig, Seat.South, undefined, undefined, {
      practiceRole: PracticeRole.Opener,
    });

    // Should be coerced to responder since DONT is an opponent convention
    expect(bundle.resolvedRole).toBe(PracticeRole.Responder);
  });
});

describe("startDrill vulnerability", () => {
  beforeEach(() => {
    clearBundleRegistry();
    registerBundle(ntBundle);
  });

  it("assigns vulnerability from tuning distribution to generated deal", async () => {
    // RNG: first call for vulnerability (0.76 → Both in equal distribution), rest for deal gen
    const bundle = await startDrill(ntBundleConventionConfig, Seat.South, testRng(0.76), undefined, {
      tuning: {
        vulnerabilityDistribution: { none: 1, ours: 1, theirs: 1, both: 1 },
      },
    });

    expect(bundle.deal.vulnerability).toBe(Vulnerability.Both);
  });

  it("uses default none-only distribution when no tuning provided", async () => {
    // Default distribution is none-only, so any RNG value yields None
    const bundle = await startDrill(ntBundleConventionConfig, Seat.South, testRng(0.1));

    expect(bundle.deal.vulnerability).toBe(Vulnerability.None);
  });

  it("respects custom tuning override", async () => {
    const bundle = await startDrill(ntBundleConventionConfig, Seat.South, testRng(0.5), undefined, {
      tuning: {
        vulnerabilityDistribution: { none: 0, ours: 0, theirs: 0, both: 1 },
      },
    });

    expect(bundle.deal.vulnerability).toBe(Vulnerability.Both);
  });
});
