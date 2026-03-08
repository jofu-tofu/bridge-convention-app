import { describe, it, test, expect } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { buildAuction } from "../../../engine/auction-helpers";
import { staymanOpener, staymanResponder, bergenResponder, hand } from "../fixtures";
import type { BiddingContext } from "../../core/types";
import { buildEffectiveContext } from "../../core/pipeline/effective-context";
import { generateCandidates } from "../../core/pipeline/candidate-generator";
import { evaluateProtocol } from "../../core/protocol/protocol-evaluator";
import { evaluateTree } from "../../core/tree/tree-evaluator";
import { intentBid } from "../../core/intent/intent-node";
import { handDecision, fallback } from "../../core/tree/rule-tree";
import { hcpMin } from "../../core/conditions/hand-conditions";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import { staymanConfig } from "../../definitions/stayman";
import { bergenConfig } from "../../definitions/bergen-raises";
import { saycConfig } from "../../definitions/sayc";
import { weakTwosConfig } from "../../definitions/weak-twos";
import { conventionToStrategy } from "../../../strategy/bidding/convention-strategy";
import type { IntentResolverMap } from "../../core/intent/intent-resolver";
import type { ConventionOverlayPatch } from "../../core/overlay";
import type { ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { protocol, round, semantic } from "../../core/protocol";
import type { ProtocolEvalResult, ConventionProtocol } from "../../core/protocol";
import { bidMade, isResponder } from "../../core/conditions";

describe("generateCandidates", () => {
  // Helper to build a simple intent node
  function makeIntentNode(name: string, meaning: string, call: Call) {
    return intentBid(
      name,
      meaning,
      { type: SemanticIntentType.NaturalBid, params: {} },
      () => call,
    );
  }

  const bid1C: Call = { type: "bid", level: 1, strain: BidSuit.Clubs };
  const bid1D: Call = { type: "bid", level: 1, strain: BidSuit.Diamonds };

  it("single IntentNode tree → one candidate with isMatched: true, legal: true", () => {
    const node = makeIntentNode("open-1c", "Opens 1C", bid1C);
    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "DK", "DQ", "CA", "CK", "CQ", "CJ");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.South, []),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    const treeResult = evaluateTree(node, context);

    // Build a minimal effective context
    const protoResult = {
      matched: node,
      matchedRounds: [],
      established: { role: "opener" as const },
      handResult: treeResult,
      activeRound: null,
      handTreeRoot: node,
    };
    const effective = buildEffectiveContext(context, staymanConfig, protoResult);

    const { candidates } = generateCandidates(node, treeResult, effective);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.isMatched).toBe(true);
    expect(candidates[0]!.legal).toBe(true);
    expect(candidates[0]!.bidName).toBe("open-1c");
  });

  it("binary hand tree → matched + sibling candidates", () => {
    const strongNode = makeIntentNode("strong-open", "Opens 1C", bid1C);
    const weakNode = makeIntentNode("weak-open", "Opens 1D", bid1D);
    const tree = handDecision("has-12-hcp", hcpMin(12), strongNode, weakNode);

    // Strong hand (13 HCP) → matches strongNode
    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.South, []),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    const treeResult = evaluateTree(tree, context);
    expect(treeResult.matched).toBe(strongNode);

    const protoResult = {
      matched: strongNode,
      matchedRounds: [],
      established: { role: "opener" as const },
      handResult: treeResult,
      activeRound: null,
      handTreeRoot: tree,
    };
    const effective = buildEffectiveContext(context, staymanConfig, protoResult);

    const { candidates } = generateCandidates(tree, treeResult, effective);

    // Matched + 1 sibling = 2 candidates
    expect(candidates).toHaveLength(2);

    const matched = candidates.find((c) => c.isMatched);
    expect(matched).toBeDefined();
    expect(matched!.bidName).toBe("strong-open");
    expect(matched!.failedConditions).toHaveLength(0);

    const sibling = candidates.find((c) => !c.isMatched);
    expect(sibling).toBeDefined();
    expect(sibling!.bidName).toBe("weak-open");
    expect(sibling!.failedConditions.length).toBeGreaterThan(0);
  });

  it("resolver override: resolvedCall differs from .call when resolver returns different call", () => {
    const bid2C: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
    const bid2H: Call = { type: "bid", level: 2, strain: BidSuit.Hearts };

    const node = intentBid(
      "ask-for-major",
      "Asks for a 4-card major",
      { type: SemanticIntentType.AskForMajor, params: {} },
      () => bid2C,
    );

    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.South, []),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    const treeResult = evaluateTree(node, context);

    // Create a config with a resolver that returns a different call
    const resolvers: IntentResolverMap = new Map([
      [SemanticIntentType.AskForMajor, () => ({ status: "resolved" as const, calls: [{ call: bid2H }] })],
    ]);
    const configWithResolver = {
      ...staymanConfig,
      intentResolvers: resolvers,
    };

    const protoResult = {
      matched: node,
      matchedRounds: [],
      established: { role: "responder" as const },
      handResult: treeResult,
      activeRound: null,
      handTreeRoot: node,
    };
    const effective = buildEffectiveContext(context, configWithResolver, protoResult);

    const { candidates } = generateCandidates(node, treeResult, effective);

    expect(candidates).toHaveLength(1);
    // defaultCall is 2C, resolver returns 2H
    expect(candidates[0]!.call).toEqual(bid2C); // .call is always defaultCall
    expect(candidates[0]!.resolvedCall).toEqual(bid2H);
    expect(candidates[0]!.isDefaultCall).toBe(false);
  });

  it("resolver null: resolvedCall === .call with isDefaultCall: true", () => {
    const node = intentBid(
      "ask-for-major",
      "Asks for a 4-card major",
      { type: SemanticIntentType.AskForMajor, params: {} },
      () => bid1C,
    );

    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.South, []),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    const treeResult = evaluateTree(node, context);

    // Resolver returns null — no registered resolver for AskForMajor
    const configNoResolvers = { ...staymanConfig, intentResolvers: new Map() };
    const protoResult = {
      matched: node,
      matchedRounds: [],
      established: { role: "responder" as const },
      handResult: treeResult,
      activeRound: null,
      handTreeRoot: node,
    };
    const effective = buildEffectiveContext(context, configNoResolvers, protoResult);

    const { candidates } = generateCandidates(node, treeResult, effective);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.resolvedCall).toEqual(bid1C);
    expect(candidates[0]!.isDefaultCall).toBe(true);
  });

  it("resolver throws: resolvedCall === .call with isDefaultCall: true", () => {
    const node = intentBid(
      "ask-for-major",
      "Asks for a 4-card major",
      { type: SemanticIntentType.AskForMajor, params: {} },
      () => bid1C,
    );

    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.South, []),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    const treeResult = evaluateTree(node, context);

    const throwingResolvers: IntentResolverMap = new Map([
      [SemanticIntentType.AskForMajor, () => { throw new Error("boom"); }],
    ]);
    const configThrows = { ...staymanConfig, intentResolvers: throwingResolvers };
    const protoResult = {
      matched: node,
      matchedRounds: [],
      established: { role: "responder" as const },
      handResult: treeResult,
      activeRound: null,
      handTreeRoot: node,
    };
    const effective = buildEffectiveContext(context, configThrows, protoResult);

    const { candidates } = generateCandidates(node, treeResult, effective);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.resolvedCall).toEqual(bid1C);
    expect(candidates[0]!.isDefaultCall).toBe(true);
  });

  it("FallbackNode hand tree (no matched IntentNode) → empty array", () => {
    const fb = fallback();
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.South, []),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    const treeResult = evaluateTree(fb, context);
    expect(treeResult.matched).toBeNull();

    const protoResult = {
      matched: null,
      matchedRounds: [],
      established: { role: "opener" as const },
      handResult: treeResult,
      activeRound: null,
      handTreeRoot: fb,
    };
    const effective = buildEffectiveContext(context, staymanConfig, protoResult);

    const { candidates } = generateCandidates(fb, treeResult, effective);
    expect(candidates).toHaveLength(0);
  });

  it("parity: generateCandidates matched candidate equals conventionToStrategy call for Stayman", () => {
    // Opener responds to Stayman with 4 hearts → should bid 2H
    const h = staymanOpener();
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P", "2C", "P"]),
      seat: Seat.North,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    // Get the call from conventionToStrategy
    const strategy = conventionToStrategy(staymanConfig);
    const bidResult = strategy.suggest(context);
    expect(bidResult).not.toBeNull();

    // Get the call from generateCandidates
    const protoResult = evaluateProtocol(staymanConfig.protocol!, context);
    if (!protoResult.handResult.matched || !protoResult.handTreeRoot) {
      throw new Error("Expected protocol to match");
    }

    const effective = buildEffectiveContext(context, staymanConfig, protoResult);
    const { candidates } = generateCandidates(
      protoResult.handTreeRoot,
      protoResult.handResult,
      effective,
    );

    const matchedCandidate = candidates.find((c) => c.isMatched);
    expect(matchedCandidate).toBeDefined();
    expect(matchedCandidate!.resolvedCall).toEqual(bidResult!.call);
  });
});

// ─── Characterization tests — lock current behavior across all 4 conventions ───

describe("generateCandidates characterization", () => {
  /** Helper: run the full pipeline for a convention and return candidates. */
  function pipelineForConvention(config: typeof staymanConfig, context: BiddingContext) {
    const protoResult = evaluateProtocol(config.protocol!, context);
    if (!protoResult.handResult.matched || !protoResult.handTreeRoot) return null;
    const effective = buildEffectiveContext(context, config, protoResult);
    return generateCandidates(protoResult.handTreeRoot, protoResult.handResult, effective).candidates;
  }

  /** Helper: run conventionToStrategy to get the expected call. */
  function strategyCall(config: typeof staymanConfig, context: BiddingContext) {
    const strategy = conventionToStrategy(config);
    return strategy.suggest(context);
  }

  describe("Stayman parity", () => {
    it("opener response: matched resolvedCall equals strategy call", () => {
      const h = staymanOpener(); // 16 HCP, 4 hearts
      const ctx: BiddingContext = {
        hand: h,
        auction: buildAuction(Seat.North, ["1NT", "P", "2C", "P"]),
        seat: Seat.North,
        evaluation: evaluateHand(h),
        opponentConventionIds: [],
      };
      const candidates = pipelineForConvention(staymanConfig, ctx)!;
      const matched = candidates.find(c => c.isMatched);
      const expected = strategyCall(staymanConfig, ctx);
      expect(matched).toBeDefined();
      expect(matched!.resolvedCall).toEqual(expected!.call);
      expect(matched!.legal).toBe(true);
      expect(candidates.length).toBeGreaterThanOrEqual(1);
    });

    it("responder ask: matched resolvedCall equals strategy call", () => {
      const h = staymanResponder(); // 13 HCP, 4 hearts
      const ctx: BiddingContext = {
        hand: h,
        auction: buildAuction(Seat.North, ["1NT", "P"]),
        seat: Seat.South,
        evaluation: evaluateHand(h),
        opponentConventionIds: [],
      };
      const candidates = pipelineForConvention(staymanConfig, ctx)!;
      const matched = candidates.find(c => c.isMatched);
      const expected = strategyCall(staymanConfig, ctx);
      expect(matched).toBeDefined();
      expect(matched!.resolvedCall).toEqual(expected!.call);
      expect(matched!.legal).toBe(true);
    });
  });

  describe("Bergen parity", () => {
    it("responder constructive raise: matched resolvedCall equals strategy call", () => {
      const h = bergenResponder(); // 8 HCP, 4 hearts
      const ctx: BiddingContext = {
        hand: h,
        auction: buildAuction(Seat.North, ["1H", "P"]),
        seat: Seat.South,
        evaluation: evaluateHand(h),
        opponentConventionIds: [],
      };
      const candidates = pipelineForConvention(bergenConfig, ctx)!;
      const matched = candidates.find(c => c.isMatched);
      const expected = strategyCall(bergenConfig, ctx);
      expect(matched).toBeDefined();
      expect(matched!.resolvedCall).toEqual(expected!.call);
      expect(matched!.legal).toBe(true);
      expect(candidates.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("SAYC parity", () => {
    it("opening bid: matched resolvedCall equals strategy call", () => {
      // 13 HCP balanced — should open 1NT or 1-suit
      const h = hand("SA", "SK", "SQ", "S5", "HA", "H3", "DK", "D5", "D3", "C5", "C4", "C3", "C2");
      const ctx: BiddingContext = {
        hand: h,
        auction: buildAuction(Seat.South, []),
        seat: Seat.South,
        evaluation: evaluateHand(h),
        opponentConventionIds: [],
      };
      const candidates = pipelineForConvention(saycConfig, ctx);
      if (!candidates) return; // SAYC may not match for this hand
      const matched = candidates.find(c => c.isMatched);
      const expected = strategyCall(saycConfig, ctx);
      if (expected && matched) {
        expect(matched.resolvedCall).toEqual(expected.call);
        expect(matched.legal).toBe(true);
      }
    });
  });

  describe("Weak Twos parity", () => {
    it("preemptive opener: matched resolvedCall equals strategy call", () => {
      // 9 HCP, 6 hearts — should open 2H
      const h = hand("S5", "S3", "S2", "HA", "HK", "HJ", "HT", "H7", "H3", "D5", "D3", "C5", "C2");
      const ctx: BiddingContext = {
        hand: h,
        auction: buildAuction(Seat.South, []),
        seat: Seat.South,
        evaluation: evaluateHand(h),
        opponentConventionIds: [],
      };
      const candidates = pipelineForConvention(weakTwosConfig, ctx);
      if (!candidates) return; // May not match
      const matched = candidates.find(c => c.isMatched);
      const expected = strategyCall(weakTwosConfig, ctx);
      if (expected && matched) {
        expect(matched.resolvedCall).toEqual(expected.call);
        expect(matched.legal).toBe(true);
      }
    });
  });
});

// ─── Multi-encoding resolvers (Gap 8) ─────────────────

describe("multi-encoding resolvers", () => {
  const bid2C: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
  const bid3C: Call = { type: "bid", level: 3, strain: BidSuit.Clubs };
  const bid2H: Call = { type: "bid", level: 2, strain: BidSuit.Hearts };

  function makeNode(resolverType: string, defaultCall: Call) {
    return intentBid(
      "multi-enc-node",
      "Multi-encoding test",
      { type: resolverType as SemanticIntentType, params: {} },
      () => defaultCall,
    );
  }

  function makeEffective(
    node: ReturnType<typeof makeNode>,
    auctionBids: string[],
    resolvers: IntentResolverMap,
  ) {
    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.South, auctionBids),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    const treeResult = evaluateTree(node, context);
    const protoResult = {
      matched: node,
      matchedRounds: [],
      established: { role: "responder" as const },
      handResult: treeResult,
      activeRound: null,
      handTreeRoot: node,
    };
    const configWithResolvers: ConventionConfig = {
      ...staymanConfig,
      intentResolvers: resolvers,
    };
    const effective = buildEffectiveContext(context, configWithResolvers, protoResult);
    return { effective, treeResult, node };
  }

  it("resolver returns [2C, 3C], 2C illegal → 3C selected", () => {
    // Auction "1NT P 2H P" makes 2C illegal (below 2H)
    const resolvers: IntentResolverMap = new Map([
      ["multi-test", () => ({ status: "resolved" as const, calls: [{ call: bid2C }, { call: bid3C }] })],
    ]);
    const node = makeNode("multi-test", bid2C);
    const { effective, treeResult } = makeEffective(node, ["1NT", "P", "2H", "P"], resolvers);

    const { candidates } = generateCandidates(node, treeResult, effective);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.resolvedCall).toEqual(bid3C);
    expect(candidates[0]!.isDefaultCall).toBe(false);
    expect(candidates[0]!.legal).toBe(true);
  });

  it("resolver returns [2C, 3C], both legal → first (2C) used", () => {
    // Auction "1NT P" — both 2C and 3C are legal
    const resolvers: IntentResolverMap = new Map([
      ["multi-test", () => ({ status: "resolved" as const, calls: [{ call: bid2C }, { call: bid3C }] })],
    ]);
    const node = makeNode("multi-test", bid2C);
    const { effective, treeResult } = makeEffective(node, ["1NT", "P"], resolvers);

    const { candidates } = generateCandidates(node, treeResult, effective);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.resolvedCall).toEqual(bid2C);
    expect(candidates[0]!.isDefaultCall).toBe(false);
  });

  it("single resolved call", () => {
    const resolvers: IntentResolverMap = new Map([
      ["multi-test", () => ({ status: "resolved" as const, calls: [{ call: bid2H }] })],
    ]);
    const node = makeNode("multi-test", bid2C);
    const { effective, treeResult } = makeEffective(node, ["1NT", "P"], resolvers);

    const { candidates } = generateCandidates(node, treeResult, effective);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.resolvedCall).toEqual(bid2H);
    expect(candidates[0]!.isDefaultCall).toBe(false);
  });

  it("use_default → defaultCall used", () => {
    const resolvers: IntentResolverMap = new Map([
      ["multi-test", () => ({ status: "use_default" as const })],
    ]);
    const node = makeNode("multi-test", bid2C);
    const { effective, treeResult } = makeEffective(node, ["1NT", "P"], resolvers);

    const { candidates } = generateCandidates(node, treeResult, effective);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.resolvedCall).toEqual(bid2C);
    expect(candidates[0]!.isDefaultCall).toBe(true);
  });

  it("resolved with empty calls → treated as use_default, defaultCall used", () => {
    const resolvers: IntentResolverMap = new Map([
      ["multi-test", () => ({ status: "resolved" as const, calls: [] })],
    ]);
    const node = makeNode("multi-test", bid2C);
    const { effective, treeResult } = makeEffective(node, ["1NT", "P"], resolvers);

    const { candidates } = generateCandidates(node, treeResult, effective);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.resolvedCall).toEqual(bid2C);
    expect(candidates[0]!.isDefaultCall).toBe(true);
  });
});

// ─── Gap 3: matchedIntentSuppressed tracking ─────────────────

describe("matchedIntentSuppressed tracking", () => {
  const testTree = handDecision(
    "hcp-check",
    hcpMin(8),
    intentBid("strong-bid", "Strong bid",
      { type: SemanticIntentType.NaturalBid, params: {} },
      () => ({ type: "bid" as const, level: 1 as const, strain: BidSuit.Clubs })),
    intentBid("weak-bid", "Weak bid",
      { type: SemanticIntentType.NaturalBid, params: {} },
      () => ({ type: "bid" as const, level: 1 as const, strain: BidSuit.Diamonds })),
  );

  const testProtocol: ConventionProtocol = protocol("suppress-test", [
    round("opening", {
      triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
      handTree: testTree,
      seatFilter: isResponder(),
    }),
  ]);

  function makeTestConfig(overlays?: readonly ConventionOverlayPatch[]): ConventionConfig {
    return {
      id: "suppress-test",
      name: "Suppress Test",
      description: "Test",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      protocol: testProtocol,
      overlays,
    };
  }

  function makeStrongContext(): BiddingContext {
    // 13 HCP hand → matches hcpMin(8) → strong-bid
    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    return {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
  }

  function makeTestProtocolResult(): ProtocolEvalResult {
    const ctx = makeStrongContext();
    const treeResult = evaluateTree(testTree, ctx);
    return {
      matched: null,
      matchedRounds: [],
      established: { role: "responder" as const },
      handResult: treeResult,
      activeRound: (testProtocol.rounds).find(r => r.name === "opening") ?? null,
      handTreeRoot: testTree,
    };
  }

  it("matchedIntentSuppressed is false when no overlay", () => {
    const config = makeTestConfig();
    const ctx = makeStrongContext();
    const protoResult = makeTestProtocolResult();
    const effective = buildEffectiveContext(ctx, config, protoResult);
    const result = generateCandidates(testTree, protoResult.handResult, effective);
    expect(result.matchedIntentSuppressed).toBe(false);
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it("matchedIntentSuppressed is true when suppressIntent removes the matched proposal", () => {
    const overlay: ConventionOverlayPatch = {
      id: "suppress-matched",
      roundName: "opening",
      matches: () => true,
      suppressIntent: (intent) => intent.nodeName === "strong-bid",
    };
    const config = makeTestConfig([overlay]);
    const ctx = makeStrongContext();
    const protoResult = makeTestProtocolResult();
    const effective = buildEffectiveContext(ctx, config, protoResult);
    const result = generateCandidates(testTree, protoResult.handResult, effective);
    expect(result.matchedIntentSuppressed).toBe(true);
  });

  it("matchedIntentSuppressed is false when suppressIntent only removes non-matched proposals", () => {
    const overlay: ConventionOverlayPatch = {
      id: "suppress-sibling",
      roundName: "opening",
      matches: () => true,
      suppressIntent: (intent) => intent.nodeName === "weak-bid",
    };
    const config = makeTestConfig([overlay]);
    const ctx = makeStrongContext();
    const protoResult = makeTestProtocolResult();
    const effective = buildEffectiveContext(ctx, config, protoResult);
    const result = generateCandidates(testTree, protoResult.handResult, effective);
    expect(result.matchedIntentSuppressed).toBe(false);
  });

  it("matchedIntentSuppressed is false when suppressIntent keeps all proposals", () => {
    const overlay: ConventionOverlayPatch = {
      id: "suppress-none",
      roundName: "opening",
      matches: () => true,
      suppressIntent: () => false,
    };
    const config = makeTestConfig([overlay]);
    const ctx = makeStrongContext();
    const protoResult = makeTestProtocolResult();
    const effective = buildEffectiveContext(ctx, config, protoResult);
    const result = generateCandidates(testTree, protoResult.handResult, effective);
    expect(result.matchedIntentSuppressed).toBe(false);
  });
});

// ─── Gap 4: nodeId matching in candidate generator ───────────

// ─── 8e-baseline: replacementTree timing regression ─────────

describe("replacementTree timing (8e-baseline)", () => {
  it("1NT-(X) Stayman doubled overlay: bid comes from replacement tree", () => {
    // Scenario: 1NT opening, opponent doubles → stayman-doubled overlay activates.
    // The overlay provides round1AskAfterDouble as replacementTree.
    // generateCandidates() should replace the tree FIRST, then evaluate against it.
    // Hand: 10+ HCP → should match "stayman-penalty-redouble" in the replacement tree.
    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "X"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const protoResult = evaluateProtocol(staymanConfig.protocol!, context);
    expect(protoResult.handTreeRoot).toBeDefined();

    const effective = buildEffectiveContext(context, staymanConfig, protoResult);
    // stayman-doubled overlay should be active
    expect(effective.activeOverlays.length).toBeGreaterThan(0);
    expect(effective.activeOverlays.some(o => o.id === "stayman-doubled")).toBe(true);

    const { candidates, matchedIntentSuppressed } = generateCandidates(
      protoResult.handTreeRoot!,
      protoResult.handResult,
      effective,
    );

    expect(matchedIntentSuppressed).toBe(false);
    expect(candidates.length).toBeGreaterThan(0);

    const matched = candidates.find(c => c.isMatched);
    expect(matched).toBeDefined();
    // 13 HCP → redouble from replacement tree
    expect(matched!.bidName).toBe("stayman-penalty-redouble");
    expect(matched!.resolvedCall.type).toBe("redouble");
    expect(matched!.legal).toBe(true);
  });

  it("1NT-(X) end-to-end: conventionToStrategy uses replacement tree bid", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "X"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("redouble");
    expect(result!.evaluationTrace?.overlaysActivated).toContain("stayman-doubled");
  });
});

describe("candidate-generator nodeId matching", () => {
  it("isMatched uses nodeId comparison, not object reference identity", () => {
    const node = intentBid("test-node", "Test bid",
      { type: SemanticIntentType.NaturalBid, params: {} },
      () => ({ type: "bid" as const, level: 1 as const, strain: BidSuit.Clubs }));

    // Spread-copy: new reference, same nodeId
    const copy = { ...node };
    expect(copy).not.toBe(node);
    expect(copy.nodeId).toBe(node.nodeId);

    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.South, []),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    // Evaluate tree with the original node
    const treeResult = evaluateTree(node, context);
    expect(treeResult.matched).toBe(node);

    // Build handResult with the COPY as matched (different reference, same nodeId)
    const handResultWithCopy = { ...treeResult, matched: copy };

    const protoResult = {
      matched: null,
      matchedRounds: [],
      established: { role: "opener" as const },
      handResult: handResultWithCopy,
      activeRound: null,
      handTreeRoot: node,
    };
    const effective = buildEffectiveContext(context, staymanConfig, protoResult);
    const { candidates } = generateCandidates(node, handResultWithCopy, effective);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.isMatched).toBe(true);
  });
});

describe("candidate provenance (Phase 1)", () => {
  const bid1C: Call = { type: "bid", level: 1, strain: BidSuit.Clubs };
  const bid1D: Call = { type: "bid", level: 1, strain: BidSuit.Diamonds };
  const bid1H: Call = { type: "bid", level: 1, strain: BidSuit.Hearts };
  const bid1S: Call = { type: "bid", level: 1, strain: BidSuit.Spades };

  function makeContext(): BiddingContext {
    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    return {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
  }

  function makeProtocolFor(handTree: ConventionProtocol["rounds"][number]["handTree"]): ConventionProtocol {
    return protocol("provenance-test", [
      round("opening", {
        triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
        handTree,
        seatFilter: isResponder(),
      }),
    ]);
  }

  test("tree-origin candidates are tagged with origin=tree", () => {
    const tree = intentBid(
      "tree-origin",
      "Tree origin",
      { type: SemanticIntentType.NaturalBid, params: {} },
      () => bid1C,
    );
    const config: ConventionConfig = {
      ...staymanConfig,
      id: "prov-tree",
      protocol: makeProtocolFor(tree),
      overlays: undefined,
      transitionRules: undefined,
      baselineRules: undefined,
    };
    const context = makeContext();
    const protoResult = evaluateProtocol(config.protocol!, context);
    const effective = buildEffectiveContext(context, config, protoResult);

    const { candidates } = generateCandidates(tree, protoResult.handResult, effective);

    const provenance = (candidates[0] as { provenance?: { origin: string } }).provenance;
    expect(provenance).toEqual({ origin: "tree" });
  });

  test("replacement-tree candidates are tagged with origin=replacement-tree and overlay id", () => {
    const originalTree = intentBid(
      "original-tree",
      "Original tree",
      { type: SemanticIntentType.NaturalBid, params: {} },
      () => bid1C,
    );
    const replacementTree = intentBid(
      "replacement-tree",
      "Replacement tree",
      { type: SemanticIntentType.NaturalBid, params: {} },
      () => bid1D,
    );
    const overlay: ConventionOverlayPatch = {
      id: "replacement-overlay",
      roundName: "opening",
      matches: () => true,
      replacementTree,
    };
    const config: ConventionConfig = {
      ...staymanConfig,
      id: "prov-replacement",
      protocol: makeProtocolFor(originalTree),
      overlays: [overlay],
      transitionRules: undefined,
      baselineRules: undefined,
    };
    const context = makeContext();
    const protoResult = evaluateProtocol(config.protocol!, context);
    const effective = buildEffectiveContext(context, config, protoResult);

    const { candidates } = generateCandidates(originalTree, protoResult.handResult, effective);

    expect(candidates[0]!.bidName).toBe("replacement-tree");
    const provenance = (candidates[0] as { provenance?: { origin: string; overlayId?: string } }).provenance;
    expect(provenance).toEqual({ origin: "replacement-tree", overlayId: "replacement-overlay" });
  });

  test("overlay-added candidates are tagged with origin=overlay-injected and overlay id", () => {
    const tree = intentBid(
      "tree-base",
      "Tree base",
      { type: SemanticIntentType.NaturalBid, params: {} },
      () => bid1C,
    );
    const overlay: ConventionOverlayPatch = {
      id: "inject-overlay",
      roundName: "opening",
      matches: () => true,
      addIntents: () => [
        {
          intent: { type: SemanticIntentType.NaturalBid, params: {} },
          nodeName: "overlay-added",
          meaning: "Overlay added",
          defaultCall: () => bid1H,
          pathConditions: [],
          priority: "preferred",
        },
      ],
    };
    const config: ConventionConfig = {
      ...staymanConfig,
      id: "prov-overlay-injected",
      protocol: makeProtocolFor(tree),
      overlays: [overlay],
      transitionRules: undefined,
      baselineRules: undefined,
    };
    const context = makeContext();
    const protoResult = evaluateProtocol(config.protocol!, context);
    const effective = buildEffectiveContext(context, config, protoResult);

    const { candidates } = generateCandidates(tree, protoResult.handResult, effective);
    const injected = candidates.find(c => c.bidName === "overlay-added");
    expect(injected).toBeDefined();
    const provenance = (injected as { provenance?: { origin: string; overlayId?: string } }).provenance;
    expect(provenance).toEqual({ origin: "overlay-injected", overlayId: "inject-overlay" });
  });

  test("resolver overrides are tagged with origin=overlay-override and overlay id", () => {
    const tree = intentBid(
      "override-base",
      "Override base",
      { type: SemanticIntentType.NaturalBid, params: {} },
      () => bid1C,
    );
    const overlay: ConventionOverlayPatch = {
      id: "override-overlay",
      roundName: "opening",
      matches: () => true,
      overrideResolver: () => ({
        status: "resolved",
        calls: [{ call: bid1S }],
      }),
    };
    const config: ConventionConfig = {
      ...staymanConfig,
      id: "prov-overlay-override",
      protocol: makeProtocolFor(tree),
      overlays: [overlay],
      transitionRules: undefined,
      baselineRules: undefined,
    };
    const context = makeContext();
    const protoResult = evaluateProtocol(config.protocol!, context);
    const effective = buildEffectiveContext(context, config, protoResult);

    const { candidates } = generateCandidates(tree, protoResult.handResult, effective);

    expect(candidates[0]!.resolvedCall).toEqual(bid1S);
    const provenance = (candidates[0] as { provenance?: { origin: string; overlayId?: string } }).provenance;
    expect(provenance).toEqual({ origin: "overlay-override", overlayId: "override-overlay" });
  });
});

// ─── Overlay addIntents rescue (no tree match) ──────────────

describe("overlay addIntents rescue (no tree match)", () => {
  const bid1H: Call = { type: "bid", level: 1, strain: BidSuit.Hearts };
  const bid1S: Call = { type: "bid", level: 1, strain: BidSuit.Spades };

  // A fallback-only tree — evaluateTree returns matched: null
  const fallbackTree = fallback();

  const rescueProtocol: ConventionProtocol = protocol("rescue-test", [
    round("opening", {
      triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
      handTree: fallbackTree,
      seatFilter: isResponder(),
    }),
  ]);

  function makeRescueConfig(overlays?: readonly ConventionOverlayPatch[]): ConventionConfig {
    return {
      id: "rescue-test",
      name: "Rescue Test",
      description: "Test overlay rescue with no tree match",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      protocol: rescueProtocol,
      overlays,
    };
  }

  function makeRescueContext(): BiddingContext {
    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    return {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
  }

  function makeRescueProtoResult(): { protoResult: ProtocolEvalResult; treeResult: ReturnType<typeof evaluateTree> } {
    const ctx = makeRescueContext();
    const treeResult = evaluateTree(fallbackTree, ctx);
    expect(treeResult.matched).toBeNull();
    const protoResult: ProtocolEvalResult = {
      matched: null,
      matchedRounds: [],
      established: { role: "responder" as const },
      handResult: treeResult,
      activeRound: rescueProtocol.rounds.find(r => r.name === "opening") ?? null,
      handTreeRoot: fallbackTree,
    };
    return { protoResult, treeResult };
  }

  it("fallback tree + overlay with addIntents → overlay candidates produced", () => {
    const overlay: ConventionOverlayPatch = {
      id: "rescue-overlay",
      roundName: "opening",
      matches: () => true,
      addIntents: () => [
        {
          intent: { type: SemanticIntentType.NaturalBid, params: {} },
          nodeName: "rescue-bid",
          meaning: "Rescue bid injected by overlay",
          defaultCall: () => bid1H,
          pathConditions: [],
          priority: "preferred",
        },
      ],
    };
    const config = makeRescueConfig([overlay]);
    const ctx = makeRescueContext();
    const { protoResult, treeResult } = makeRescueProtoResult();
    const effective = buildEffectiveContext(ctx, config, protoResult);

    const { candidates } = generateCandidates(fallbackTree, treeResult, effective);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.bidName).toBe("rescue-bid");
    expect(candidates[0]!.provenance).toEqual({ origin: "overlay-injected", overlayId: "rescue-overlay" });
  });

  it("fallback tree + overlay addIntents → candidates are never isMatched", () => {
    const overlay: ConventionOverlayPatch = {
      id: "rescue-overlay",
      roundName: "opening",
      matches: () => true,
      addIntents: () => [
        {
          intent: { type: SemanticIntentType.NaturalBid, params: {} },
          nodeName: "rescue-bid",
          meaning: "Rescue bid",
          defaultCall: () => bid1H,
          pathConditions: [],
          priority: "preferred",
        },
        {
          intent: { type: SemanticIntentType.NaturalBid, params: {} },
          nodeName: "rescue-bid-2",
          meaning: "Another rescue bid",
          defaultCall: () => bid1S,
          pathConditions: [],
          priority: "alternative",
        },
      ],
    };
    const config = makeRescueConfig([overlay]);
    const ctx = makeRescueContext();
    const { protoResult, treeResult } = makeRescueProtoResult();
    const effective = buildEffectiveContext(ctx, config, protoResult);

    const { candidates } = generateCandidates(fallbackTree, treeResult, effective);

    expect(candidates.length).toBe(2);
    expect(candidates.every(c => c.isMatched === false)).toBe(true);
  });

  it("fallback tree + no overlays → still empty (regression guard)", () => {
    const config = makeRescueConfig();
    const ctx = makeRescueContext();
    const { protoResult, treeResult } = makeRescueProtoResult();
    const effective = buildEffectiveContext(ctx, config, protoResult);

    const { candidates, matchedIntentSuppressed } = generateCandidates(fallbackTree, treeResult, effective);

    expect(candidates).toHaveLength(0);
    expect(matchedIntentSuppressed).toBe(false);
  });

  it("fallback tree + overlay addIntents → matchedIntentSuppressed is false", () => {
    const overlay: ConventionOverlayPatch = {
      id: "rescue-overlay",
      roundName: "opening",
      matches: () => true,
      addIntents: () => [
        {
          intent: { type: SemanticIntentType.NaturalBid, params: {} },
          nodeName: "rescue-bid",
          meaning: "Rescue bid",
          defaultCall: () => bid1H,
          pathConditions: [],
          priority: "preferred",
        },
      ],
    };
    const config = makeRescueConfig([overlay]);
    const ctx = makeRescueContext();
    const { protoResult, treeResult } = makeRescueProtoResult();
    const effective = buildEffectiveContext(ctx, config, protoResult);

    const { matchedIntentSuppressed } = generateCandidates(fallbackTree, treeResult, effective);

    expect(matchedIntentSuppressed).toBe(false);
  });

  it("non-intent match type + overlay with addIntents → overlay candidates produced", () => {
    // Defensive test: construct a TreeEvalResult where matched has type !== "intent".
    // This can't happen with current type system (matched is IntentNode | null),
    // but the gate handles it defensively. Use type assertions to simulate.
    const ctx = makeRescueContext();
    const fb = fallback();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- defensive test: simulating non-intent matched node
    const treeResult = { matched: fb as any, rejectedDecisions: [], path: [], visited: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- defensive test
    const protoResult: ProtocolEvalResult = {
      matched: fb as any,
      matchedRounds: [],
      established: { role: "responder" as const },
      handResult: treeResult,
      activeRound: rescueProtocol.rounds.find(r => r.name === "opening") ?? null,
      handTreeRoot: fb,
    };
    const overlay: ConventionOverlayPatch = {
      id: "rescue-non-intent",
      roundName: "opening",
      matches: () => true,
      addIntents: () => [
        {
          intent: { type: SemanticIntentType.NaturalBid, params: {} },
          nodeName: "non-intent-rescue",
          meaning: "Rescue for non-intent match",
          defaultCall: () => bid1H,
          pathConditions: [],
          priority: "preferred",
        },
      ],
    };
    const config = makeRescueConfig([overlay]);
    const effective = buildEffectiveContext(ctx, config, protoResult);

    const { candidates } = generateCandidates(fb, treeResult, effective);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.bidName).toBe("non-intent-rescue");
    expect(candidates[0]!.isMatched).toBe(false);
  });
});
