import { describe, test, expect } from "vitest";
import { BidSuit, Seat } from "../../engine/types";
import { hand } from "../../engine/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import { buildAuction } from "../../engine/auction-helpers";
import type { BiddingContext } from "../../core/contracts";
import { meaningToStrategy, runMeaningPipeline } from "../bidding/meaning-strategy";
import { protocolSpecToStrategy } from "../bidding/protocol-adapter";
import { makeSurface, makeRanking } from "../../test-support/convention-factories";
import {
  ntBundle,
  bergenBundle,
  specFromBundle,
} from "../../conventions/definitions/system-registry";

// ─── Helpers ──────────────────────────────────────────────────────

function makeContext(
  h: ReturnType<typeof hand>,
  bids: string[],
  dealer: Seat = Seat.North,
  seat: Seat = Seat.South,
): BiddingContext {
  return {
    hand: h,
    auction: buildAuction(dealer, bids),
    seat,
    evaluation: evaluateHand(h),
    opponentConventionIds: [],
  };
}

// ─── meaningToStrategy (unit-level, synthetic surfaces) ───────────

describe("meaningToStrategy", () => {
  test("returns a strategy with correct id and name", () => {
    const strategy = meaningToStrategy([], "test-module", { name: "Test" });
    expect(strategy.id).toBe("test-module");
    expect(strategy.name).toBe("Test");
  });

  test("name defaults to moduleId when not provided", () => {
    const strategy = meaningToStrategy([], "my-module");
    expect(strategy.name).toBe("my-module");
  });

  test("returns null when no surfaces match the hand", () => {
    // Surface requires 15+ HCP, hand has ~10
    const surface = makeSurface({
      meaningId: "strong-bid",
      encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
      clauses: [
        { factId: "hand.hcp", operator: "gte" as const, value: 15, satisfied: false, description: "HCP >= 15" },
      ],
    });

    const strategy = meaningToStrategy([surface], "test");
    const h = hand("SA", "SK", "S8", "S7", "S6", "H4", "H3", "DQ", "D5", "D3", "CJ", "C4", "C2");
    const ctx = makeContext(h, []);

    expect(strategy.suggest(ctx)).toBeNull();
  });

  test("returns a BidResult when a surface matches", () => {
    // Surface that should match a hand with 15+ HCP
    const surface = makeSurface({
      meaningId: "strong-bid",
      encoding: { defaultCall: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
      clauses: [
        { factId: "hand.hcp", operator: "gte" as const, value: 15, satisfied: true, description: "HCP >= 15" },
      ],
      ranking: makeRanking({ recommendationBand: "should", modulePrecedence: 0, declarationOrder: 0 }),
      sourceIntent: { type: "OpenNT", params: {} },
      teachingLabel: "1NT Opening",
    });

    const strategy = meaningToStrategy([surface], "test");
    // 16 HCP balanced hand: AK spades (7) + KQ hearts (5) + QJ diamonds (3) + J clubs (1)
    const h = hand("SA", "SK", "S8", "S7", "HK", "HQ", "H5", "H3", "DQ", "DJ", "D3", "CJ", "C2");
    const ctx = makeContext(h, []);

    const result = strategy.suggest(ctx);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 1, strain: BidSuit.NoTrump });
  });

  test("getLastEvaluation returns evaluation data after suggest", () => {
    const surface = makeSurface({
      meaningId: "test-bid",
      encoding: { defaultCall: { type: "bid", level: 1, strain: BidSuit.Clubs } },
      clauses: [],
      sourceIntent: { type: "TestBid", params: {} },
      teachingLabel: "Test bid",
    });

    const strategy = meaningToStrategy([surface], "test");
    const h = hand("SA", "SK", "S8", "S7", "S6", "H4", "H3", "DQ", "D5", "D3", "CJ", "C4", "C2");
    const ctx = makeContext(h, []);

    strategy.suggest(ctx);

    const evaluation = strategy.getLastEvaluation();
    expect(evaluation).not.toBeNull();
    expect(evaluation!.pipelineResult).not.toBeNull();
    expect(evaluation!.facts).not.toBeNull();
  });

  test("BidResult includes teaching metadata", () => {
    const surface = makeSurface({
      meaningId: "labeled-bid",
      encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
      clauses: [],
      sourceIntent: { type: "StaymanAsk", params: {} },
      teachingLabel: "Stayman — asking for a 4-card major",
    });

    const strategy = meaningToStrategy([surface], "stayman");
    const h = hand("SA", "SK", "S8", "S7", "S6", "H4", "H3", "DQ", "D5", "D3", "CJ", "C4", "C2");
    const ctx = makeContext(h, []);

    const result = strategy.suggest(ctx);
    expect(result).not.toBeNull();
    expect(result!.meaning).toBe("Stayman — asking for a 4-card major");
    expect(result!.ruleName).toBe("labeled-bid");
  });

  test("BidResult includes resolvedCandidates for grading", () => {
    const surface = makeSurface({
      meaningId: "candidate-bid",
      encoding: { defaultCall: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
      clauses: [],
      sourceIntent: { type: "TestIntent", params: {} },
      teachingLabel: "Test",
    });

    const strategy = meaningToStrategy([surface], "test");
    const h = hand("SA", "SK", "S8", "S7", "S6", "H4", "H3", "DQ", "D5", "D3", "CJ", "C4", "C2");
    const ctx = makeContext(h, []);

    const result = strategy.suggest(ctx);
    expect(result).not.toBeNull();
    expect(result!.resolvedCandidates).toBeDefined();
    expect(result!.resolvedCandidates!.length).toBeGreaterThan(0);
  });

  test("evaluationTrace records strategy metadata", () => {
    const surface = makeSurface({
      meaningId: "traced-bid",
      encoding: { defaultCall: { type: "bid", level: 1, strain: BidSuit.Clubs } },
      clauses: [],
      sourceIntent: { type: "TestIntent", params: {} },
    });

    const strategy = meaningToStrategy([surface], "my-conv");
    const h = hand("SA", "SK", "S8", "S7", "S6", "H4", "H3", "DQ", "D5", "D3", "CJ", "C4", "C2");
    const ctx = makeContext(h, []);

    const result = strategy.suggest(ctx);
    expect(result).not.toBeNull();
    expect(result!.evaluationTrace).toBeDefined();
    expect(result!.evaluationTrace!.conventionId).toBe("my-conv");
  });
});

// ─── runMeaningPipeline (pure pipeline, synthetic surfaces) ───────

describe("runMeaningPipeline", () => {
  test("returns arbitration result and evaluated facts", () => {
    const surface = makeSurface({
      meaningId: "pipeline-test",
      encoding: { defaultCall: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
      clauses: [],
    });

    const h = hand("SA", "SK", "S8", "S7", "S6", "H4", "H3", "DQ", "D5", "D3", "CJ", "C4", "C2");
    const ctx = makeContext(h, []);

    const { result, facts } = runMeaningPipeline({
      surfaces: [surface],
      context: ctx,
      catalog: { definitions: [], evaluators: new Map() },
    });

    expect(result).toBeDefined();
    expect(result.truthSet).toBeDefined();
    expect(facts).toBeDefined();
  });

  test("pipeline selects higher-band surface when multiple match", () => {
    const mustSurface = makeSurface({
      meaningId: "must-bid",
      encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
      clauses: [],
      ranking: makeRanking({ recommendationBand: "must", declarationOrder: 0 }),
    });
    const shouldSurface = makeSurface({
      meaningId: "should-bid",
      encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Diamonds } },
      clauses: [],
      ranking: makeRanking({ recommendationBand: "should", declarationOrder: 0 }),
    });

    const h = hand("SA", "SK", "S8", "S7", "S6", "H4", "H3", "DQ", "D5", "D3", "CJ", "C4", "C2");
    const ctx = makeContext(h, []);

    const { result } = runMeaningPipeline({
      surfaces: [shouldSurface, mustSurface],
      context: ctx,
      catalog: { definitions: [], evaluators: new Map() },
    });

    expect(result.selected).not.toBeNull();
    expect(result.selected!.proposal.meaningId).toBe("must-bid");
  });
});

// ─── Integration with real NT bundle ──────────────────────────────

describe("protocolSpecToStrategy with NT bundle", () => {
  function ntStrategy() {
    const spec = specFromBundle(ntBundle);
    expect(spec).toBeDefined();
    return protocolSpecToStrategy(spec!);
  }

  test("strategy has correct id from system", () => {
    const strategy = ntStrategy();
    expect(strategy.id).toBe("nt-bundle");
  });

  test("suggests Stayman (2C) with 4-card major and 8+ HCP after 1NT-P", () => {
    const strategy = ntStrategy();
    // 13 HCP, 4 hearts: AKQ hearts (10) + K spades (3) = 13 HCP
    const h = hand("SK", "S5", "S2", "HA", "HK", "HQ", "H3", "D5", "D3", "D2", "C5", "C3", "C2");
    const ctx = makeContext(h, ["1NT", "P"]);

    const result = strategy.suggest(ctx);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });
  });

  test("suggests Jacoby Transfer (2D) with 5+ hearts after 1NT-P", () => {
    const strategy = ntStrategy();
    // 8 HCP, 5 hearts: KQ hearts (5) + QJ diamonds (3) = 8 HCP
    const h = hand("S5", "S3", "S2", "HK", "HQ", "H9", "H7", "H3", "DQ", "DJ", "D3", "C5", "C2");
    const ctx = makeContext(h, ["1NT", "P"]);

    const result = strategy.suggest(ctx);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Diamonds });
  });

  test("returns natural NT bid for balanced hand without 4-card major (system facts wired)", () => {
    // Natural NT surfaces (2NT invite, 3NT game) depend on system-level facts
    // (system.responder.inviteValues, system.responder.gameValues) which are
    // now included via createSystemFactCatalog in the pipeline.
    const strategy = ntStrategy();
    // 9 HCP balanced, no 4-card major, no 5-card major → invite with 2NT
    const h = hand("SJ", "S5", "S2", "H4", "H3", "H2", "DQ", "DJ", "D8", "D3", "CK", "CQ", "C5");
    const ctx = makeContext(h, ["1NT", "P"]);

    const result = strategy.suggest(ctx);
    // With system facts wired, natural NT surfaces can satisfy their clauses
    expect(result).not.toBeNull();
  });

  test("returns null when no convention surfaces are active (empty auction)", () => {
    const strategy = ntStrategy();
    // With empty auction, the rule modules are in idle state — no surfaces active for South
    const h = hand("SA", "SK", "S8", "S7", "S6", "H4", "H3", "DQ", "D5", "D3", "CJ", "C4", "C2");
    const ctx = makeContext(h, []);

    const result = strategy.suggest(ctx);
    // No surfaces should be active before the 1NT opening
    expect(result).toBeNull();
  });

  test("BidResult contains teaching information for grading", () => {
    const strategy = ntStrategy();
    // Stayman hand
    const h = hand("SK", "S5", "S2", "HA", "HK", "HQ", "H3", "D5", "D3", "D2", "C5", "C3", "C2");
    const ctx = makeContext(h, ["1NT", "P"]);

    const result = strategy.suggest(ctx);
    expect(result).not.toBeNull();
    expect(result!.meaning).toBeDefined();
    expect(result!.meaning!.length).toBeGreaterThan(0);
    expect(result!.resolvedCandidates).toBeDefined();
    expect(result!.resolvedCandidates!.length).toBeGreaterThan(0);
  });

  test("getLastEvaluation provides arbitration details after suggest", () => {
    const strategy = ntStrategy();
    const h = hand("SK", "S5", "S2", "HA", "HK", "HQ", "H3", "D5", "D3", "D2", "C5", "C3", "C2");
    const ctx = makeContext(h, ["1NT", "P"]);

    strategy.suggest(ctx);

    const evaluation = strategy.getLastEvaluation();
    expect(evaluation).not.toBeNull();
    expect(evaluation!.pipelineResult).not.toBeNull();
    expect(evaluation!.pipelineResult!.truthSet.length).toBeGreaterThan(0);
    expect(evaluation!.facts).not.toBeNull();
  });
});

// ─── Integration with real Bergen bundle ──────────────────────────

describe("protocolSpecToStrategy with Bergen bundle", () => {
  function bergenStrategy() {
    const spec = specFromBundle(bergenBundle);
    expect(spec).toBeDefined();
    return protocolSpecToStrategy(spec!);
  }

  test("suggests Bergen raise with appropriate hand after 1H-P", () => {
    const strategy = bergenStrategy();
    // Constructive raise hand: 8 HCP, 4 hearts
    // KJ hearts (4) + QJ diamonds (3) + J clubs (1) = 8 HCP, 4 hearts
    const h = hand("S5", "S3", "S2", "HK", "HJ", "H7", "H3", "DQ", "DJ", "D8", "D4", "CJ", "C2");
    const ctx = makeContext(h, ["1H", "P"]);

    const result = strategy.suggest(ctx);
    expect(result).not.toBeNull();
    // With 8 HCP + 4 hearts, should get a Bergen raise (3C constructive or similar)
    expect(result!.call.type).toBe("bid");
  });

  test("suggests 1H opening from stub surface with empty auction and appropriate hand", () => {
    // Bergen includes stub 1H/1S opening surfaces (MajorOpen intent) for phase transitions.
    // With an empty auction and a hand with 5+ hearts + 12+ HCP, the stub surface fires.
    const strategy = bergenStrategy();
    // 13 HCP, 5 hearts: AK hearts (7) + QJ diamonds (3) + K clubs (3) = 13 HCP
    const h = hand("S5", "S3", "S2", "HA", "HK", "H9", "H7", "H3", "DQ", "DJ", "D4", "CK", "C2");
    const ctx = makeContext(h, []);

    const result = strategy.suggest(ctx);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 1, strain: BidSuit.Hearts });
  });

  test("suggests natural 1NT after 1H-P when responder hand has no major support but is in 1NT range", () => {
    const strategy = bergenStrategy();
    // 8 HCP, only 2 hearts AND only 3 spades (no Bergen raise, no 1♠ bid):
    // AK clubs (7) + J diamonds (1) = 8 HCP, shape 3-2-4-4
    // Within the system's 1NT response range (6-10 in SAYC), so natural 1NT applies
    const h = hand("S9", "S7", "S6", "H4", "H3", "DJ", "D8", "D5", "D3", "CA", "CK", "C4", "C2");
    const ctx = makeContext(h, ["1H", "P"]);

    const result = strategy.suggest(ctx);
    // Without 4+ hearts, Bergen raise surfaces don't match, but natural 1NT does
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 1, strain: BidSuit.NoTrump });
  });
});
