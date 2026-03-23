/**
 * Tests for protocol-adapter.ts — the entry point for rule interpretation
 * in the strategy layer.
 *
 * Tests the public API: protocolSpecToStrategy(), buildObservationLogViaRules(),
 * and findMatchingClaimForCall().
 */

import { describe, it, expect } from "vitest";
import { BidSuit, Seat } from "../../engine/types";
import type { Call } from "../../engine/types";
import { buildAuction } from "../../engine/auction-helpers";
import { hand } from "../../engine/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import { createBiddingContext, specFromBundle, ntBundle } from "../../conventions";
import type { ConventionModule, ConventionSpec } from "../../conventions";
import { makeSurface, makeRanking } from "../../test-support/convention-factories";
import type { BidMeaning } from "../../core/contracts/meaning";
import type { FactCatalogExtension } from "../../core/contracts/fact-catalog";
import {
  protocolSpecToStrategy,
  buildObservationLogViaRules,
  findMatchingClaimForCall,
} from "../bidding/protocol-adapter";
import { SAYC_SYSTEM_CONFIG } from "../../core/contracts/system-config";

// ── Helpers ──────────────────────────────────────────────────────────

const emptyFacts: FactCatalogExtension = {
  definitions: [],
  evaluators: new Map(),
};

/** Create a minimal ConventionModule with a single state entry. */
function makeRuleModule(overrides: {
  id?: string;
  surfaces?: BidMeaning[];
  turn?: "opener" | "responder" | "opponent";
  local?: string;
}): ConventionModule {
  const surfaces = overrides.surfaces ?? [
    makeSurface({
      meaningId: "test:bid",
      encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
      clauses: [],
      ranking: makeRanking({ recommendationBand: "should" }),
      sourceIntent: { type: "TestBid", params: {} },
      teachingLabel: "Test bid",
    }),
  ];

  return {
    moduleId: overrides.id ?? "test-module",
    description: "test module",
    local: {
      initial: "idle",
      transitions: [],
    },
    states: [
      {
        phase: overrides.local ?? "idle",
        turn: overrides.turn ?? "responder",
        surfaces,
      },
    ],
    facts: emptyFacts,
    explanationEntries: [],
  };
}

/** Create a minimal ConventionSpec wrapping convention modules. */
function makeSpec(modules: readonly ConventionModule[]): ConventionSpec {
  return {
    id: "test-spec",
    name: "Test Spec",
    modules,
  };
}

/** 10 HCP responder with 4-4 majors (good for Stayman). */
const staymanHand = () =>
  hand("SK", "SJ", "S9", "S2", "HK", "HQ", "H7", "H3", "D8", "D6", "D4", "C7", "C3");

/** Weak hand (0-7 HCP) — no convention applies. */
const weakHand = () =>
  hand("S9", "S8", "S4", "S2", "H7", "H5", "H3", "D8", "D6", "D4", "C7", "C5", "C3");

// ── protocolSpecToStrategy ───────────────────────────────────────────

describe("protocolSpecToStrategy", () => {
  it("returns a strategy with the spec's id and name", () => {
    const mod = makeRuleModule({});
    const spec = makeSpec([mod]);
    const strategy = protocolSpecToStrategy(spec);

    expect(strategy.id).toBe("test-spec");
    expect(strategy.name).toBe("Test Spec");
  });

  it("returns null when spec has no rule modules", () => {
    const spec = makeSpec([]);
    const strategy = protocolSpecToStrategy(spec);

    const h = staymanHand();
    const context = createBiddingContext({
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
    });

    expect(strategy.suggest(context)).toBeNull();
  });

  it("returns null when no surfaces match the auction context", () => {
    // Module only fires for responder, but we're querying as opener (North)
    // after an empty auction. With no resolved bids in history, North is opener.
    // But our module requires local phase "other-phase" which doesn't exist.
    const mod = makeRuleModule({ turn: "responder", local: "nonexistent-phase" });
    const spec = makeSpec([mod]);
    const strategy = protocolSpecToStrategy(spec);

    const h = staymanHand();
    const context = createBiddingContext({
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
    });

    expect(strategy.suggest(context)).toBeNull();
  });

  it("returns a BidResult when surfaces match and clauses are satisfied", () => {
    // Surface with no clauses (always satisfied) — use opener turn since
    // with a synthetic module that doesn't resolve 1NT, South is treated as opener
    const surface = makeSurface({
      meaningId: "test:always-bid",
      encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
      clauses: [],
      ranking: makeRanking({ recommendationBand: "should" }),
      sourceIntent: { type: "TestBid", params: {} },
      teachingLabel: "Always bid 2C",
    });

    const mod = makeRuleModule({ surfaces: [surface], turn: "opener" });
    const spec = makeSpec([mod]);
    const strategy = protocolSpecToStrategy(spec);

    const h = staymanHand();
    const context = createBiddingContext({
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
    });

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("bid");
    if (result!.call.type === "bid") {
      expect(result!.call.level).toBe(2);
      expect(result!.call.strain).toBe(BidSuit.Clubs);
    }
  });

  it("populates lastEvaluation after suggest()", () => {
    const surface = makeSurface({
      meaningId: "test:eval-check",
      encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
      clauses: [],
      ranking: makeRanking({ recommendationBand: "should" }),
      sourceIntent: { type: "TestBid", params: {} },
      teachingLabel: "Eval check",
    });

    // Use opener turn — synthetic module doesn't resolve 1NT, so South = opener
    const mod = makeRuleModule({ surfaces: [surface], turn: "opener" });
    const spec = makeSpec([mod]);
    const strategy = protocolSpecToStrategy(spec);

    const h = staymanHand();
    const context = createBiddingContext({
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
    });

    strategy.suggest(context);

    const evaluation = strategy.getLastEvaluation();
    expect(evaluation).not.toBeNull();
    expect(evaluation!.pipelineResult).not.toBeNull();
    expect(evaluation!.facts).not.toBeNull();
    expect(evaluation!.auctionContext).not.toBeNull();
  });
});

// ── buildObservationLogViaRules ──────────────────────────────────────

describe("buildObservationLogViaRules", () => {
  it("returns empty log for empty history", () => {
    const mod = makeRuleModule({});
    const log = buildObservationLogViaRules([], Seat.South, [mod]);
    expect(log).toHaveLength(0);
  });

  it("marks passes as raw-only steps", () => {
    const mod = makeRuleModule({});
    const history: { call: Call; seat: Seat }[] = [
      { call: { type: "pass" }, seat: Seat.East },
    ];

    const log = buildObservationLogViaRules(history, Seat.South, [mod]);
    expect(log).toHaveLength(1);
    expect(log[0]!.status).toBe("raw-only");
    expect(log[0]!.resolvedClaim).toBeNull();
  });

  it("resolves a known bid to a surface claim", () => {
    const surface = makeSurface({
      meaningId: "test:1nt",
      encoding: { defaultCall: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
      clauses: [],
      ranking: makeRanking({ recommendationBand: "should" }),
      sourceIntent: { type: "Open1NT", params: {} },
      teachingLabel: "1NT opening",
    });

    const mod: ConventionModule = {
      moduleId: "test",
      description: "test module",
      local: { initial: "idle", transitions: [] },
      states: [
        { phase: "idle", turn: "opener", surfaces: [surface] },
      ],
      facts: emptyFacts,
      explanationEntries: [],
    };

    const history: { call: Call; seat: Seat }[] = [
      { call: { type: "bid", level: 1, strain: BidSuit.NoTrump }, seat: Seat.North },
    ];

    const log = buildObservationLogViaRules(history, Seat.South, [mod]);
    expect(log).toHaveLength(1);
    expect(log[0]!.status).toBe("resolved");
    expect(log[0]!.resolvedClaim).not.toBeNull();
    expect(log[0]!.resolvedClaim!.meaningId).toBe("test:1nt");
  });

  it("marks unrecognized bids as off-system", () => {
    const mod = makeRuleModule({});
    const history: { call: Call; seat: Seat }[] = [
      // No module matches a 7NT bid
      { call: { type: "bid", level: 7, strain: BidSuit.NoTrump }, seat: Seat.North },
    ];

    const log = buildObservationLogViaRules(history, Seat.South, [mod]);
    expect(log).toHaveLength(1);
    expect(log[0]!.status).toBe("off-system");
    expect(log[0]!.resolvedClaim).toBeNull();
  });

  it("threads kernel state through resolved steps", () => {
    // Use real intent types so normalizeIntent produces BidAction
    // that can trigger phase transitions
    const surface1 = makeSurface({
      meaningId: "test:opener",
      encoding: { defaultCall: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
      sourceIntent: { type: "NTOpening", params: {} },
      teachingLabel: "1NT opening",
    });

    const surface2 = makeSurface({
      meaningId: "test:stayman-ask",
      encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
      sourceIntent: { type: "StaymanAsk", params: {} },
      teachingLabel: "Stayman",
    });

    const mod: ConventionModule = {
      moduleId: "test",
      description: "test module",
      local: {
        initial: "idle",
        transitions: [
          // NTOpening produces { act: "open", strain: "notrump" }
          { from: "idle", to: "opened", on: { act: "open", strain: "notrump" } },
        ],
      },
      states: [
        { phase: "idle", turn: "opener", surfaces: [surface1] },
        {
          phase: "opened",
          turn: "responder",
          surfaces: [surface2],
          negotiationDelta: { forcing: "one-round", captain: "responder" },
        },
      ],
      facts: emptyFacts,
      explanationEntries: [],
    };

    const history: { call: Call; seat: Seat }[] = [
      { call: { type: "bid", level: 1, strain: BidSuit.NoTrump }, seat: Seat.North },
      { call: { type: "pass" }, seat: Seat.East },
      { call: { type: "bid", level: 2, strain: BidSuit.Clubs }, seat: Seat.South },
    ];

    const log = buildObservationLogViaRules(history, Seat.South, [mod]);
    expect(log).toHaveLength(3);

    // First step: resolved, kernel stays at initial
    expect(log[0]!.status).toBe("resolved");
    expect(log[0]!.stateAfter.forcing).toBe("none");

    // Second step: pass is raw-only, kernel unchanged
    expect(log[1]!.status).toBe("raw-only");

    // Third step: resolved with kernel delta
    expect(log[2]!.status).toBe("resolved");
    expect(log[2]!.stateAfter.forcing).toBe("one-round");
    expect(log[2]!.stateAfter.captain).toBe("responder");
  });
});

// ── findMatchingClaimForCall ─────────────────────────────────────────

describe("findMatchingClaimForCall", () => {
  it("returns null when no claims match the call", () => {
    const surface = makeSurface({
      meaningId: "test:2c",
      encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
    });

    const results = [
      {
        moduleId: "test",
        resolved: [{ surface, negotiationDelta: undefined }],
      },
    ];

    // Looking for 3D, but only 2C is available
    const call: Call = { type: "bid", level: 3, strain: BidSuit.Diamonds };
    expect(findMatchingClaimForCall(results, call)).toBeNull();
  });

  it("returns null for non-bid calls", () => {
    const surface = makeSurface({
      meaningId: "test:2c",
      encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
    });

    const results = [
      {
        moduleId: "test",
        resolved: [{ surface, negotiationDelta: undefined }],
      },
    ];

    expect(findMatchingClaimForCall(results, { type: "pass" })).toBeNull();
  });

  it("returns the matching claim when exactly one matches", () => {
    const surface = makeSurface({
      meaningId: "test:2c",
      encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
    });

    const results = [
      {
        moduleId: "test",
        resolved: [{ surface, negotiationDelta: undefined }],
      },
    ];

    const call: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
    const match = findMatchingClaimForCall(results, call);

    expect(match).not.toBeNull();
    expect(match!.surface.meaningId).toBe("test:2c");
    expect(match!.moduleId).toBe("test");
  });

  it("arbitrates multiple matching claims by recommendation band", () => {
    const mustSurface = makeSurface({
      meaningId: "test:must-bid",
      encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
      ranking: makeRanking({ recommendationBand: "must" }),
    });
    const shouldSurface = makeSurface({
      meaningId: "test:should-bid",
      encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
      ranking: makeRanking({ recommendationBand: "should" }),
    });

    const results = [
      {
        moduleId: "mod-a",
        resolved: [{ surface: shouldSurface, negotiationDelta: undefined }],
      },
      {
        moduleId: "mod-b",
        resolved: [{ surface: mustSurface, negotiationDelta: undefined }],
      },
    ];

    const call: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
    const match = findMatchingClaimForCall(results, call);

    expect(match!.surface.meaningId).toBe("test:must-bid");
  });
});

// ── Integration with real Stayman rules ──────────────────────────────

describe("protocolSpecToStrategy with real NT system", () => {
  it("suggests Stayman 2C for a responder with 4-4 majors and 10+ HCP", () => {
    const spec = specFromBundle(ntBundle, SAYC_SYSTEM_CONFIG);
    expect(spec).toBeDefined();

    const strategy = protocolSpecToStrategy(spec!);

    const h = staymanHand();
    const context = createBiddingContext({
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      dealer: Seat.North,
    });

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("bid");
    if (result!.call.type === "bid") {
      expect(result!.call.level).toBe(2);
      expect(result!.call.strain).toBe(BidSuit.Clubs);
    }
  });

  it("suggests pass for a weak hand after 1NT-P", () => {
    const spec = specFromBundle(ntBundle, SAYC_SYSTEM_CONFIG);
    const strategy = protocolSpecToStrategy(spec!);

    const h = weakHand();
    const context = createBiddingContext({
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      dealer: Seat.North,
    });

    const result = strategy.suggest(context);
    // Weak hand with no 5-card suit: either null (no matching surface)
    // or pass is the recommendation
    if (result !== null) {
      expect(result.call.type).toBe("pass");
    }
  });

  it("builds an observation log for a multi-step Stayman auction", () => {
    const ruleModules = ntBundle.modules;

    const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D", "P"]);
    const history = auction.entries.map((e) => ({ call: e.call, seat: e.seat }));

    const log = buildObservationLogViaRules(history, Seat.South, ruleModules);

    // 6 entries total (1NT, P, 2C, P, 2D, P)
    expect(log).toHaveLength(6);

    // 1NT should be resolved
    expect(log[0]!.status).toBe("resolved");

    // Passes should be raw-only
    expect(log[1]!.status).toBe("raw-only");
    expect(log[3]!.status).toBe("raw-only");
    expect(log[5]!.status).toBe("raw-only");

    // 2C Stayman should be resolved (may be claimed by stayman or smolen
    // since both modules have idle-phase rules for responder)
    expect(log[2]!.status).toBe("resolved");
    expect(["stayman", "smolen"]).toContain(log[2]!.resolvedClaim!.moduleId);

    // 2D denial should be resolved
    expect(log[4]!.status).toBe("resolved");
  });

  it("threads kernel state correctly through Stayman auction", () => {
    const ruleModules = ntBundle.modules;

    const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P"]);
    const history = auction.entries.map((e) => ({ call: e.call, seat: e.seat }));

    const log = buildObservationLogViaRules(history, Seat.South, ruleModules);

    // After 2C (Stayman ask): forcing should be one-round, captain should be responder
    const staymanStep = log[2]!;
    expect(staymanStep.status).toBe("resolved");
    expect(staymanStep.stateAfter.forcing).toBe("one-round");
    expect(staymanStep.stateAfter.captain).toBe("responder");
  });
});
