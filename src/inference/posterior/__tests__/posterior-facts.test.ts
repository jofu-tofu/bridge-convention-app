import { describe, it, expect } from "vitest";
import { POSTERIOR_FACT_HANDLERS } from "../posterior-facts";
import type { PosteriorFactRequest } from "../posterior-types";
import type { Hand } from "../../../engine/types";
import { hand } from "../../../engine/__tests__/fixtures";

// ── Test hands ──────────────────────────────────────────────────────
// Notation: first char = suit (S/H/D/C), rest = rank (A/K/Q/J/T/9..2)
// Every hand is exactly 13 cards with controlled suit distributions.

/** 4H 3S 3D 3C — balanced 4-3-3-3, 0 HCP */
const fourHeartsHand = hand(
  "H2", "H3", "H4", "H5",
  "S2", "S3", "S4",
  "D2", "D3", "D4",
  "C2", "C3", "C4",
);

/** 3H 4S 3D 3C — balanced 4-3-3-3, 0 HCP */
const threeHeartsHand = hand(
  "H2", "H3", "H4",
  "S2", "S3", "S4", "S5",
  "D2", "D3", "D4",
  "C2", "C3", "C4",
);

/** 5H 3S 3D 2C — balanced 5-3-3-2, 0 HCP */
const fiveHeartsHand = hand(
  "H2", "H3", "H4", "H5", "H6",
  "S2", "S3", "S4",
  "D2", "D3", "D4",
  "C2", "C3",
);

/** 4D 3S 3H 3C — balanced 4-3-3-3, 0 HCP */
const fourDiamondsHand = hand(
  "D2", "D3", "D4", "D5",
  "S2", "S3", "S4",
  "H2", "H3", "H4",
  "C2", "C3", "C4",
);

/** 4C 3S 3H 3D — balanced 4-3-3-3, 0 HCP */
const fourClubsHand = hand(
  "C2", "C3", "C4", "C5",
  "S2", "S3", "S4",
  "H2", "H3", "H4",
  "D2", "D3", "D4",
);

/** 4H 4S 3D 2C — balanced 4-4-3-2, 0 HCP */
const bothMajorsHand = hand(
  "H2", "H3", "H4", "H5",
  "S2", "S3", "S4", "S5",
  "D2", "D3", "D4",
  "C2", "C3",
);

/** 6S 4H 2D 1C — NOT balanced, 0 HCP */
const unbalancedHand = hand(
  "S2", "S3", "S4", "S5", "S6", "S7",
  "H2", "H3", "H4", "H5",
  "D2", "D3",
  "C2",
);

/** 4S 3H 3D 3C — balanced, 10 HCP (SA=4 + HK=3 + DQ=2 + CJ=1) */
const tenHcpHand = hand(
  "SA", "S2", "S3", "S4",
  "HK", "H2", "H3",
  "DQ", "D2", "D3",
  "CJ", "C2", "C3",
);

/** 3S 3H 4D 3C — 5 HCP (SA=4 + DJ=1) */
const fiveHcpHand = hand(
  "SA", "S2", "S3",
  "H2", "H3", "H4",
  "DJ", "D2", "D3", "D4",
  "C2", "C3", "C4",
);

/** 3S 3H 3D 4C — 15 HCP (SA=4 + SK=3 + HA=4 + DK=3 + CJ=1) */
const fifteenHcpHand = hand(
  "SA", "SK", "S2",
  "HA", "H2", "H3",
  "DK", "D2", "D3",
  "CJ", "C2", "C3", "C4",
);

// ── Helpers ─────────────────────────────────────────────────────────

/** A valid hand to pass as ownHand when the handler ignores it. */
const dummyOwnHand = threeHeartsHand;

/** Build a single sample map where seatId maps to h. */
function makeSample(seatId: string, h: Hand): ReadonlyMap<string, Hand> {
  return new Map([[seatId, h]]);
}

/** Build n identical samples. */
function makeSamples(
  seatId: string,
  h: Hand,
  n: number,
): ReadonlyMap<string, Hand>[] {
  return Array.from({ length: n }, () => makeSample(seatId, h));
}

// ── Registry ────────────────────────────────────────────────────────

describe("POSTERIOR_FACT_HANDLERS registry", () => {
  it("contains exactly the eight expected handler keys", () => {
    const keys = [...POSTERIOR_FACT_HANDLERS.keys()];
    expect(keys).toHaveLength(8);
    expect(keys).toContain("bridge.partnerHas4HeartsLikely");
    expect(keys).toContain("bridge.partnerHas4SpadesLikely");
    expect(keys).toContain("bridge.partnerHas4DiamondsLikely");
    expect(keys).toContain("bridge.partnerHas4ClubsLikely");
    expect(keys).toContain("module.stayman.nsHaveEightCardFitLikely");
    expect(keys).toContain("bridge.combinedHcpInRangeLikely");
    expect(keys).toContain("module.stayman.openerStillBalancedLikely");
    expect(keys).toContain("module.stayman.openerHasSecondMajorLikely");
  });

  it("returns undefined for an unknown factId", () => {
    expect(POSTERIOR_FACT_HANDLERS.get("bridge.doesNotExist")).toBeUndefined();
  });
});

// ── partnerHas4InSuitLikely ─────────────────────────────────────────

describe("partnerHas4InSuitLikely", () => {
  const handler = POSTERIOR_FACT_HANDLERS.get(
    "bridge.partnerHas4HeartsLikely",
  )!;
  const baseRequest: PosteriorFactRequest = {
    factId: "bridge.partnerHas4HeartsLikely",
    seatId: "N",
    conditionedOn: ["H"],
  };

  it("returns expectedValue 0 and confidence 0 for zero samples", () => {
    const result = handler(baseRequest, [], dummyOwnHand, 100);
    expect(result.expectedValue).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it("returns expectedValue 1.0 when all samples have 4+ hearts", () => {
    const samples = makeSamples("N", fourHeartsHand, 10);
    const result = handler(baseRequest, samples, dummyOwnHand, 10);
    expect(result.expectedValue).toBe(1.0);
  });

  it("returns expectedValue 0.0 when no samples have 4+ hearts", () => {
    const samples = makeSamples("N", threeHeartsHand, 10);
    const result = handler(baseRequest, samples, dummyOwnHand, 10);
    expect(result.expectedValue).toBe(0.0);
  });

  it("returns expectedValue equal to fraction of matching samples", () => {
    const samples = [
      makeSample("N", fourHeartsHand),  // 4H ✓
      makeSample("N", threeHeartsHand), // 3H ✗
      makeSample("N", fourHeartsHand),  // 4H ✓
      makeSample("N", threeHeartsHand), // 3H ✗
      makeSample("N", fourHeartsHand),  // 4H ✓
    ];
    const result = handler(baseRequest, samples, dummyOwnHand, 10);
    expect(result.expectedValue).toBeCloseTo(3 / 5);
  });

  it("returns confidence equal to samples.length / totalRequested", () => {
    const samples = makeSamples("N", fourHeartsHand, 7);
    const result = handler(baseRequest, samples, dummyOwnHand, 20);
    expect(result.confidence).toBeCloseTo(7 / 20);
  });

  it("conditions on spades when conditionedOn is S", () => {
    const spadesHandler = POSTERIOR_FACT_HANDLERS.get(
      "bridge.partnerHas4SpadesLikely",
    )!;
    const request: PosteriorFactRequest = {
      factId: "bridge.partnerHas4SpadesLikely",
      seatId: "N",
      conditionedOn: ["S"],
    };
    // threeHeartsHand has 4 spades
    const samples = makeSamples("N", threeHeartsHand, 5);
    const result = spadesHandler(request, samples, dummyOwnHand, 5);
    expect(result.expectedValue).toBe(1.0);
  });

  it("conditions on diamonds when conditionedOn is D", () => {
    const request: PosteriorFactRequest = {
      ...baseRequest,
      factId: "bridge.partnerHas4HeartsLikely",
      conditionedOn: ["D"],
    };
    const matchSamples = makeSamples("N", fourDiamondsHand, 3);
    const noMatchSamples = makeSamples("N", threeHeartsHand, 2);
    const result = handler(
      request,
      [...matchSamples, ...noMatchSamples],
      dummyOwnHand,
      5,
    );
    expect(result.expectedValue).toBeCloseTo(3 / 5);
  });

  it("conditions on clubs when conditionedOn is C", () => {
    const request: PosteriorFactRequest = {
      ...baseRequest,
      factId: "bridge.partnerHas4HeartsLikely",
      conditionedOn: ["C"],
    };
    const samples = makeSamples("N", fourClubsHand, 5);
    const result = handler(request, samples, dummyOwnHand, 5);
    expect(result.expectedValue).toBe(1.0);
  });

  it("returns zero when conditionedOn is absent", () => {
    const request: PosteriorFactRequest = {
      factId: "bridge.partnerHas4HeartsLikely",
      seatId: "N",
    };
    const samples = [
      makeSample("N", fourHeartsHand),  // 4H ✓
      makeSample("N", threeHeartsHand), // 3H ✗
    ];
    const result = handler(request, samples, dummyOwnHand, 2);
    expect(result.expectedValue).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it("propagates factId and seatId to the result", () => {
    const request: PosteriorFactRequest = {
      factId: "bridge.partnerHas4HeartsLikely",
      seatId: "E",
      conditionedOn: ["H"],
    };
    const samples = makeSamples("E", fourHeartsHand, 1);
    const result = handler(request, samples, dummyOwnHand, 1);
    expect(result.factId).toBe("bridge.partnerHas4HeartsLikely");
    expect(result.seatId).toBe("E");
  });
});

// ── nsHaveEightCardFitLikely ────────────────────────────────────────

describe("nsHaveEightCardFitLikely", () => {
  const handler = POSTERIOR_FACT_HANDLERS.get(
    "module.stayman.nsHaveEightCardFitLikely",
  )!;
  const baseRequest: PosteriorFactRequest = {
    factId: "module.stayman.nsHaveEightCardFitLikely",
    seatId: "N",
  };

  it("returns expectedValue 0 and confidence 0 for zero samples", () => {
    const result = handler(baseRequest, [], dummyOwnHand, 100);
    expect(result.expectedValue).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it("returns 1.0 when own + partner always have 8+ hearts combined", () => {
    // ownHand: fiveHeartsHand (5H 3S), partner: fourHeartsHand (4H 3S)
    // combined hearts: 5 + 4 = 9 >= 8
    const samples = makeSamples("N", fourHeartsHand, 10);
    const result = handler(baseRequest, samples, fiveHeartsHand, 10);
    expect(result.expectedValue).toBe(1.0);
  });

  it("returns 0.0 when own + partner never reach 8 in either major", () => {
    // ownHand: fourHeartsHand (4H 3S), partner: threeHeartsHand (3H 4S)
    // combined hearts: 4 + 3 = 7 < 8, combined spades: 3 + 4 = 7 < 8
    const samples = makeSamples("N", threeHeartsHand, 10);
    const result = handler(baseRequest, samples, fourHeartsHand, 10);
    expect(result.expectedValue).toBe(0.0);
  });

  it("returns correct fraction for mixed samples", () => {
    // ownHand: fourHeartsHand (4H 3S)
    // partner fiveHeartsHand (5H 3S): combined H = 9 >= 8 ✓
    // partner threeHeartsHand (3H 4S): combined H = 7, S = 7 ✗
    const samples = [
      makeSample("N", fiveHeartsHand),
      makeSample("N", threeHeartsHand),
      makeSample("N", fiveHeartsHand),
    ];
    const result = handler(baseRequest, samples, fourHeartsHand, 6);
    expect(result.expectedValue).toBeCloseTo(2 / 3);
    expect(result.confidence).toBeCloseTo(3 / 6);
  });

  it("detects fit via spades", () => {
    // ownHand: threeHeartsHand (3H 4S), partner: threeHeartsHand (3H 4S)
    // combined spades: 4 + 4 = 8 >= 8 ✓
    const samples = makeSamples("N", threeHeartsHand, 5);
    const result = handler(baseRequest, samples, threeHeartsHand, 5);
    expect(result.expectedValue).toBe(1.0);
  });

  it("does not count minor-suit fits", () => {
    // ownHand: fourDiamondsHand (3H 3S 4D 3C), partner: fourDiamondsHand (3H 3S 4D 3C)
    // combined H = 6, S = 6, neither >= 8 (diamonds 8 does not count)
    const samples = makeSamples("N", fourDiamondsHand, 5);
    const result = handler(baseRequest, samples, fourDiamondsHand, 5);
    expect(result.expectedValue).toBe(0.0);
  });
});

// ── combinedHcpInRangeLikely ────────────────────────────────────────

describe("combinedHcpInRangeLikely", () => {
  const handler = POSTERIOR_FACT_HANDLERS.get(
    "bridge.combinedHcpInRangeLikely",
  )!;
  const baseRequest: PosteriorFactRequest = {
    factId: "bridge.combinedHcpInRangeLikely",
    seatId: "N",
    conditionedOn: ["20", "25"],
  };

  it("returns expectedValue 0 and confidence 0 for zero samples", () => {
    const result = handler(baseRequest, [], tenHcpHand, 100);
    expect(result.expectedValue).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it("returns 1.0 when all combined HCPs are in range", () => {
    // ownHand: tenHcpHand (10 HCP), partner: fifteenHcpHand (15 HCP)
    // combined = 25, range [20, 25] ✓
    const samples = makeSamples("N", fifteenHcpHand, 10);
    const result = handler(baseRequest, samples, tenHcpHand, 10);
    expect(result.expectedValue).toBe(1.0);
  });

  it("returns 0.0 when no combined HCPs are in range", () => {
    // ownHand: tenHcpHand (10 HCP), partner: fiveHcpHand (5 HCP)
    // combined = 15, range [20, 25] ✗
    const samples = makeSamples("N", fiveHcpHand, 10);
    const result = handler(baseRequest, samples, tenHcpHand, 10);
    expect(result.expectedValue).toBe(0.0);
  });

  it("returns correct fraction for mixed samples", () => {
    // ownHand: tenHcpHand (10 HCP)
    // partner fifteenHcpHand (15): combined 25, in [20, 25] ✓
    // partner fiveHcpHand (5): combined 15, NOT in [20, 25] ✗
    const samples = [
      makeSample("N", fifteenHcpHand),
      makeSample("N", fiveHcpHand),
      makeSample("N", fifteenHcpHand),
      makeSample("N", fiveHcpHand),
    ];
    const result = handler(baseRequest, samples, tenHcpHand, 8);
    expect(result.expectedValue).toBeCloseTo(2 / 4);
    expect(result.confidence).toBeCloseTo(4 / 8);
  });

  it("uses conditionedOn[0] as min and conditionedOn[1] as max", () => {
    // ownHand: tenHcpHand (10), partner: tenHcpHand (10) -> combined 20
    const samples = makeSamples("N", tenHcpHand, 5);

    // Range [19, 21] -> 20 in range ✓
    const inRange: PosteriorFactRequest = {
      ...baseRequest,
      conditionedOn: ["19", "21"],
    };
    expect(handler(inRange, samples, tenHcpHand, 5).expectedValue).toBe(1.0);

    // Range [21, 25] -> 20 NOT in range ✗
    const tooHigh: PosteriorFactRequest = {
      ...baseRequest,
      conditionedOn: ["21", "25"],
    };
    expect(handler(tooHigh, samples, tenHcpHand, 5).expectedValue).toBe(0.0);
  });

  it("treats boundary values as inclusive", () => {
    // ownHand: tenHcpHand (10), partner: tenHcpHand (10) -> combined 20
    const samples = makeSamples("N", tenHcpHand, 5);

    // Range [20, 20] -- combined is exactly at both boundaries
    const exact: PosteriorFactRequest = {
      ...baseRequest,
      conditionedOn: ["20", "20"],
    };
    expect(handler(exact, samples, tenHcpHand, 5).expectedValue).toBe(1.0);
  });

  it("defaults to min 0 max 40 when conditionedOn is absent", () => {
    const request: PosteriorFactRequest = {
      factId: "bridge.combinedHcpInRangeLikely",
      seatId: "N",
    };
    // combined = 20, range [0, 40] -> always in range
    const samples = makeSamples("N", tenHcpHand, 5);
    const result = handler(request, samples, tenHcpHand, 5);
    expect(result.expectedValue).toBe(1.0);
  });
});

// ── openerStillBalancedLikely ───────────────────────────────────────

describe("openerStillBalancedLikely", () => {
  const handler = POSTERIOR_FACT_HANDLERS.get(
    "module.stayman.openerStillBalancedLikely",
  )!;
  const baseRequest: PosteriorFactRequest = {
    factId: "module.stayman.openerStillBalancedLikely",
    seatId: "N",
  };

  it("returns expectedValue 0 and confidence 0 for zero samples", () => {
    const result = handler(baseRequest, [], dummyOwnHand, 100);
    expect(result.expectedValue).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it("returns 1.0 when all sample hands are balanced", () => {
    // fourHeartsHand: 4-3-3-3 -> balanced
    const samples = makeSamples("N", fourHeartsHand, 10);
    const result = handler(baseRequest, samples, dummyOwnHand, 10);
    expect(result.expectedValue).toBe(1.0);
  });

  it("returns 0.0 when no sample hands are balanced", () => {
    // unbalancedHand: 6-4-2-1 -> not balanced
    const samples = makeSamples("N", unbalancedHand, 10);
    const result = handler(baseRequest, samples, dummyOwnHand, 10);
    expect(result.expectedValue).toBe(0.0);
  });

  it("returns correct fraction for mixed samples", () => {
    const samples = [
      makeSample("N", fourHeartsHand), // balanced 4-3-3-3 ✓
      makeSample("N", unbalancedHand), // 6-4-2-1 ✗
      makeSample("N", bothMajorsHand), // balanced 4-4-3-2 ✓
    ];
    const result = handler(baseRequest, samples, dummyOwnHand, 6);
    expect(result.expectedValue).toBeCloseTo(2 / 3);
    expect(result.confidence).toBeCloseTo(3 / 6);
  });

  it("recognises all three balanced shapes", () => {
    // 4-3-3-3: fourHeartsHand
    // 4-4-3-2: bothMajorsHand
    // 5-3-3-2: fiveHeartsHand
    const samples = [
      makeSample("N", fourHeartsHand),
      makeSample("N", bothMajorsHand),
      makeSample("N", fiveHeartsHand),
    ];
    const result = handler(baseRequest, samples, dummyOwnHand, 3);
    expect(result.expectedValue).toBe(1.0);
  });

  it("returns confidence equal to samples.length / totalRequested", () => {
    const samples = makeSamples("N", fourHeartsHand, 4);
    const result = handler(baseRequest, samples, dummyOwnHand, 16);
    expect(result.confidence).toBeCloseTo(4 / 16);
  });
});

// ── openerHasSecondMajorLikely ──────────────────────────────────────

describe("openerHasSecondMajorLikely", () => {
  const handler = POSTERIOR_FACT_HANDLERS.get(
    "module.stayman.openerHasSecondMajorLikely",
  )!;
  const baseRequest: PosteriorFactRequest = {
    factId: "module.stayman.openerHasSecondMajorLikely",
    seatId: "N",
  };

  it("returns expectedValue 0 and confidence 0 for zero samples", () => {
    const result = handler(baseRequest, [], dummyOwnHand, 100);
    expect(result.expectedValue).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it("returns 1.0 when all sample hands have 4+ in both majors", () => {
    // bothMajorsHand: 4H 4S
    const samples = makeSamples("N", bothMajorsHand, 10);
    const result = handler(baseRequest, samples, dummyOwnHand, 10);
    expect(result.expectedValue).toBe(1.0);
  });

  it("returns 0.0 when no sample hands have 4+ in both majors", () => {
    // fourHeartsHand: 4H 3S -> only hearts >= 4
    const samples = makeSamples("N", fourHeartsHand, 10);
    const result = handler(baseRequest, samples, dummyOwnHand, 10);
    expect(result.expectedValue).toBe(0.0);
  });

  it("returns correct fraction for mixed samples", () => {
    const samples = [
      makeSample("N", bothMajorsHand),  // 4H 4S ✓
      makeSample("N", fourHeartsHand),  // 4H 3S ✗
      makeSample("N", bothMajorsHand),  // 4H 4S ✓
      makeSample("N", threeHeartsHand), // 3H 4S ✗
    ];
    const result = handler(baseRequest, samples, dummyOwnHand, 8);
    expect(result.expectedValue).toBeCloseTo(2 / 4);
    expect(result.confidence).toBeCloseTo(4 / 8);
  });

  it("requires 4+ in BOTH hearts and spades not just one", () => {
    // fourHeartsHand: 4H but only 3S
    const heartOnly = makeSamples("N", fourHeartsHand, 5);
    const result1 = handler(baseRequest, heartOnly, dummyOwnHand, 5);
    expect(result1.expectedValue).toBe(0.0);

    // threeHeartsHand: 4S but only 3H
    const spadeOnly = makeSamples("N", threeHeartsHand, 5);
    const result2 = handler(baseRequest, spadeOnly, dummyOwnHand, 5);
    expect(result2.expectedValue).toBe(0.0);
  });

  it("returns confidence equal to samples.length / totalRequested", () => {
    const samples = makeSamples("N", bothMajorsHand, 3);
    const result = handler(baseRequest, samples, dummyOwnHand, 12);
    expect(result.confidence).toBeCloseTo(3 / 12);
  });
});
