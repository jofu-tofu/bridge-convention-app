import { describe, test, expect } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { ContractBid } from "../../engine/types";
import { staymanConfig } from "../../conventions/definitions/stayman";
import { bergenConfig } from "../../conventions/definitions/bergen-raises";
import { weakTwosConfig } from "../../conventions/definitions/weak-twos";
import { saycConfig } from "../../conventions/definitions/sayc";
import {
  staymanResponder,
  staymanOpener,
  bergenResponder,
  noMajorHand,
  auctionFromBids,
  hand,
} from "../../conventions/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import type { BiddingContext } from "../../conventions/core/types";
import { conventionToStrategy } from "../bidding/convention-strategy";
import type { ConventionOverlayPatch } from "../../conventions/core/overlay";
import { ConventionCategory } from "../../conventions/core/types";
import type { ConventionConfig } from "../../conventions/core/types";
import { InterferenceKind } from "../../conventions/core/dialogue/dialogue-state";
import { protocol, round, semantic } from "../../conventions/core/protocol";
import { hcpMin, bidMade, isResponder } from "../../conventions/core/conditions";
import { handDecision, fallback } from "../../conventions/core/rule-tree";
import { buildAuction } from "../../engine/auction-helpers";
import type { IntentResolverMap } from "../../conventions/core/intent/intent-resolver";
import { intentBid } from "../../conventions/core/intent/intent-node";
import { SemanticIntentType } from "../../conventions/core/intent/semantic-intent";

describe("conventionToStrategy", () => {
  test("supports injected lookup without registry setup", () => {
    const opponentConvention: ConventionConfig = {
      id: "opponent-local-map",
      name: "Opponent Local Map",
      description: "Synthetic opponent convention for injected lookup tests",
      category: ConventionCategory.Competitive,
      dealConstraints: { seats: [] },
      protocol: staymanConfig.protocol,
      interferenceSignatures: [
        {
          kind: InterferenceKind.TakeoutDouble,
          isNatural: false,
          matches(call) {
            return call.type === "double";
          },
        },
      ],
    };
    const localLookup = (id: string): ConventionConfig => {
      if (id === opponentConvention.id) return opponentConvention;
      throw new Error(`missing local convention: ${id}`);
    };
    const strategy = conventionToStrategy(staymanConfig, { lookupConvention: localLookup });
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: auctionFromBids(Seat.North, ["1NT", "X"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [opponentConvention.id],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("stayman-penalty-redouble");
  });

  test("propagates errors from injected lookup for missing IDs", () => {
    const throwingLookup = (id: string): ConventionConfig => {
      throw new Error(`injected lookup failed: ${id}`);
    };
    const strategy = conventionToStrategy(staymanConfig, { lookupConvention: throwingLookup });
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: auctionFromBids(Seat.North, ["1NT", "X"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: ["missing-injected"],
    };

    expect(() => strategy.suggest(context)).toThrowError("injected lookup failed: missing-injected");
  });

  test("returns BiddingStrategy with convention-prefixed id and name", () => {
    const strategy = conventionToStrategy(staymanConfig);
    expect(strategy.id).toBe("convention:stayman");
    expect(strategy.name).toBe("Stayman");
  });

  test("suggest returns BidResult for Stayman ask context", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const h = staymanResponder();
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const context: BiddingContext = {
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("bid");
    const bid = result!.call as ContractBid;
    expect(bid.level).toBe(2);
    expect(bid.strain).toBe(BidSuit.Clubs);
    expect(result!.ruleName).toBe("stayman-ask");
    expect(result!.explanation).toBeTruthy();
  });

  test("suggest returns null when no rule matches", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const h = noMajorHand();
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const context: BiddingContext = {
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).toBeNull();
  });

  test("suggest includes treePath with forkPoint when tree matches", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const h = staymanResponder();
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const context: BiddingContext = {
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.treePath).toBeDefined();
    expect(result!.treePath!.matchedNodeName).toBe("stayman-ask");
    expect(result!.treePath!.path.length).toBeGreaterThan(0);
    expect(result!.treePath!.visited.length).toBeGreaterThan(0);
    // Every visited entry has depth and parentNodeName
    for (const entry of result!.treePath!.visited) {
      expect(typeof entry.depth).toBe("number");
      expect(entry.depth).toBeGreaterThanOrEqual(0);
    }
  });

  test("suggest includes siblings in treePath for opener response", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const opener = staymanOpener();
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const context: BiddingContext = {
      hand: opener,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(opener),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.treePath).toBeDefined();
    expect(result!.treePath!.siblings).toBeDefined();
    expect(result!.treePath!.siblings!.length).toBeGreaterThan(0);

    // Each sibling has valid shape
    for (const sibling of result!.treePath!.siblings!) {
      expect(sibling.bidName).toBeTruthy();
      expect(sibling.meaning).toBeTruthy();
      expect(sibling.call).toBeDefined();
      expect(Array.isArray(sibling.failedConditions)).toBe(true);
    }
  });

  test("suggest preserves rule metadata from evaluateBiddingRules", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const opener = staymanOpener();
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const context: BiddingContext = {
      hand: opener,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(opener),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("stayman-response-hearts");
    expect(result!.explanation).toContain("heart");
  });
});

// ─── Step 3 characterization tests: lock behavior before pipeline refactor ──

describe("conventionToStrategy — candidate pipeline characterization", () => {
  test("Stayman resolver path: opener responds 2H via intent resolution", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const opener = staymanOpener();
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const context: BiddingContext = {
      hand: opener,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(opener),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    // Resolved call: 2H (opener has 4 hearts)
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
    // Tree path preserved
    expect(result!.treePath).toBeDefined();
    expect(result!.treePath!.matchedNodeName).toBe("stayman-response-hearts");
    expect(result!.treePath!.visited.length).toBeGreaterThan(0);
    // Candidates present
    expect(result!.treePath!.candidates).toBeDefined();
    expect(result!.treePath!.candidates!.length).toBeGreaterThan(0);
  });

  test("Bergen protocol path: responder bids constructive raise", () => {
    const strategy = conventionToStrategy(bergenConfig);
    const h = bergenResponder(); // 8 HCP, 4 hearts
    const auction = auctionFromBids(Seat.North, ["1H", "P"]);
    const context: BiddingContext = {
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    // Bergen constructive raise resolves to 3H (ShowSupport → 3M via resolver)
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
    expect(result!.treePath).toBeDefined();
    expect(result!.treePath!.matchedNodeName).toBeTruthy();
    expect(result!.treePath!.siblings).toBeDefined();
    expect(result!.treePath!.siblings!.length).toBeGreaterThan(0);
  });

  test("Weak Twos resolver path: Ogust response resolves correctly", () => {
    const strategy = conventionToStrategy(weakTwosConfig);
    // Opener: 7 HCP, good 6-card heart suit (K, Q) → 3D "min good" via Ogust
    const opener = hand("S5", "S3", "S2", "HK", "HQ", "H9", "H7", "H5", "H3", "DQ", "C5", "C3", "C2");
    const auction = auctionFromBids(Seat.North, ["2H", "P", "2NT", "P"]);
    const context: BiddingContext = {
      hand: opener,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(opener),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    // Ogust 3D = min good
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Diamonds });
    expect(result!.treePath).toBeDefined();
    expect(result!.treePath!.matchedNodeName).toBeTruthy();
  });

  test("SAYC defaultCall path: opening bid uses defaultCall", () => {
    const strategy = conventionToStrategy(saycConfig);
    // 16 HCP balanced, 4 spades → 1NT opening
    const h = hand("SA", "SK", "SQ", "S2", "HK", "H5", "H3", "DK", "D5", "D3", "C5", "C3", "C2");
    const auction = auctionFromBids(Seat.South, []);
    const context: BiddingContext = {
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 1, strain: BidSuit.NoTrump });
    expect(result!.treePath).toBeDefined();
    expect(result!.treePath!.matchedNodeName).toBeTruthy();
  });
});

// ─── Gap 3: suppress fallback — strategy returns null ────────

// ─── Gap 8: resolvedCandidates on TreeEvalSummary ─────────

describe("conventionToStrategy — resolvedCandidates (Gap 8)", () => {
  test("resolvedCandidates populated when candidate pipeline runs", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const opener = staymanOpener();
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const context: BiddingContext = {
      hand: opener,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(opener),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.treePath).toBeDefined();
    expect(result!.treePath!.resolvedCandidates).toBeDefined();
    expect(result!.treePath!.resolvedCandidates!.length).toBeGreaterThan(0);

    // Each DTO has expected shape
    for (const rc of result!.treePath!.resolvedCandidates!) {
      expect(rc.bidName).toBeTruthy();
      expect(rc.meaning).toBeTruthy();
      expect(rc.call).toBeDefined();
      expect(rc.resolvedCall).toBeDefined();
      expect(typeof rc.isDefaultCall).toBe("boolean");
      expect(typeof rc.legal).toBe("boolean");
      expect(typeof rc.isMatched).toBe("boolean");
      expect(typeof rc.intentType).toBe("string");
      expect(Array.isArray(rc.failedConditions)).toBe(true);
    }
  });

  test("resolvedCandidates undefined when pipeline doesn't run (no IntentNode match)", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const h = noMajorHand();
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const context: BiddingContext = {
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    // No match → null result, no treePath
    expect(result).toBeNull();
  });

  test("resolvedCandidates includes matched candidate first", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const opener = staymanOpener();
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const context: BiddingContext = {
      hand: opener,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(opener),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    const candidates = result!.treePath!.resolvedCandidates!;
    // First candidate is the matched one
    expect(candidates[0]!.isMatched).toBe(true);
  });

  test("resolvedCandidates DTO includes provenance", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const opener = staymanOpener();
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const context: BiddingContext = {
      hand: opener,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(opener),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    const candidates = result!.treePath!.resolvedCandidates!;
    const matched = candidates.find(c => c.isMatched);

    expect(matched).toBeDefined();
    expect(matched!.provenance).toEqual({ origin: "tree" });
  });
});

describe("conventionToStrategy — suppression fallback", () => {
  test("suggest returns null when overlay suppresses the matched candidate", () => {
    const bid2C = { type: "bid" as const, level: 2 as const, strain: BidSuit.Clubs };
    const testTree = handDecision(
      "hcp-check",
      hcpMin(8),
      intentBid("ask-bid", "Ask bid",
        { type: SemanticIntentType.AskForMajor, params: {} },
        () => bid2C),
      fallback("too-weak"),
    );
    const overlay: ConventionOverlayPatch = {
      id: "suppress-all",
      roundName: "test-round",
      matches: () => true,
      suppressIntent: () => true,
    };
    const testConfig: ConventionConfig = {
      id: "suppress-test",
      name: "Suppress Test",
      description: "Test",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      protocol: protocol("suppress-test", [
        round("test-round", {
          triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
          handTree: testTree,
          seatFilter: isResponder(),
        }),
      ]),
      overlays: [overlay],
    };

    const strategy = conventionToStrategy(testConfig);
    // 13 HCP hand → matches hcpMin(8) → ask-bid, but overlay suppresses it
    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).toBeNull();
  });
});

describe("conventionToStrategy — forcing-obligation trace", () => {
  function makeDecliningStaymanConfig(): ConventionConfig {
    const decliningResolvers: IntentResolverMap = new Map([
      [SemanticIntentType.AskForMajor, () => ({ status: "declined" as const })],
      [SemanticIntentType.ShowHeldSuit, () => ({ status: "declined" as const })],
      [SemanticIntentType.DenyHeldSuit, () => ({ status: "declined" as const })],
    ]);
    return {
      ...staymanConfig,
      id: "stayman-declining-test",
      name: "Stayman Declining Test",
      intentResolvers: decliningResolvers,
    };
  }

  test("trace records forcingDeclined when protocol matched, no candidate selected, and forcing", () => {
    const decliningConfig = makeDecliningStaymanConfig();

    const strategy = conventionToStrategy(decliningConfig);
    const opener = staymanOpener();
    const context: BiddingContext = {
      hand: opener,
      auction: auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]),
      seat: Seat.North,
      evaluation: evaluateHand(opener),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.evaluationTrace).toBeDefined();
    expect(result!.evaluationTrace!.protocolMatched).toBe(true);
    expect(result!.evaluationTrace!.selectedTier).toBe("none");
    expect(result!.evaluationTrace!.forcingDeclined).toBe(true);
  });

  test("trace does not record forcingDeclined when auction is non-forcing", () => {
    const decliningConfig = makeDecliningStaymanConfig();

    const strategy = conventionToStrategy(decliningConfig);
    const responder = staymanResponder();
    const context: BiddingContext = {
      hand: responder,
      auction: auctionFromBids(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(responder),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.evaluationTrace).toBeDefined();
    expect(result!.evaluationTrace!.protocolMatched).toBe(true);
    expect(result!.evaluationTrace!.selectedTier).toBe("none");
    expect(result!.evaluationTrace!.forcingDeclined).toBeUndefined();
  });

  test("trace does not record forcingDeclined when protocol does not match", () => {
    const decliningConfig = makeDecliningStaymanConfig();

    const strategy = conventionToStrategy(decliningConfig);
    const opener = staymanOpener();
    const context: BiddingContext = {
      hand: opener,
      auction: auctionFromBids(Seat.North, ["1C", "P"]),
      seat: Seat.North,
      evaluation: evaluateHand(opener),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).toBeNull();
  });
});

describe("conventionToStrategy — effectivePath trace", () => {
  function makeRemapConfig(id: string, withResolver: boolean): ConventionConfig {
    const tree = handDecision(
      "hcp-check",
      hcpMin(8),
      intentBid("ask-bid", "Ask bid",
        { type: SemanticIntentType.AskForMajor, params: {} },
        () => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
      fallback("too-weak"),
    );

    return {
      id,
      name: id,
      description: "Test convention",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      protocol: protocol(id, [
        round("test-round", {
          triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
          handTree: tree,
          seatFilter: isResponder(),
        }),
      ]),
      intentResolvers: withResolver
        ? new Map([
            [SemanticIntentType.AskForMajor, () => ({
              status: "resolved" as const,
              calls: [{ call: { type: "bid" as const, level: 2 as const, strain: BidSuit.Diamonds } }],
            })],
          ])
        : undefined,
    };
  }

  test("effectivePath populated when resolver remaps selected candidate", () => {
    const config = makeRemapConfig("effective-path-remap", true);
    const strategy = conventionToStrategy(config);

    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.evaluationTrace?.effectivePath).toEqual({
      candidateBidName: "ask-bid",
      wasOverlayReplaced: false,
      wasResolverRemapped: true,
    });
  });

  test("effectivePath remains undefined for matched default-call selection", () => {
    const config = makeRemapConfig("effective-path-default", false);
    const strategy = conventionToStrategy(config);

    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.evaluationTrace?.effectivePath).toBeUndefined();
  });
});

// ─── Phase 2a: treeInferenceData on BidResult ────────────────

describe("conventionToStrategy — treeInferenceData", () => {
  test("populates pathConditions from matched tree path hand conditions", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const h = staymanResponder(); // Has 4-card major, 8+ HCP
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const context: BiddingContext = {
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.treeInferenceData).toBeDefined();
    expect(result!.treeInferenceData!.pathConditions.length).toBeGreaterThan(0);

    // Each entry has type and params from the condition's .inference field
    for (const entry of result!.treeInferenceData!.pathConditions) {
      expect(typeof entry.type).toBe("string");
      expect(entry.params).toBeDefined();
      expect(typeof entry.params).toBe("object");
    }
  });

  test("includes rejected conditions from unmatched tree branches", () => {
    // Build a tree with two hand branches: hcpMin(15) fails, hcpMin(5) succeeds
    // The hcpMin(15) branch is rejected and should appear in rejectedConditions
    const testTree = handDecision(
      "high-hcp-check",
      hcpMin(15),
      intentBid("strong-bid", "Strong bid",
        { type: SemanticIntentType.Signoff, params: {} },
        () => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
      handDecision(
        "low-hcp-check",
        hcpMin(5),
        intentBid("weak-bid", "Weak bid",
          { type: SemanticIntentType.Signoff, params: {} },
          () => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
        fallback("too-weak"),
      ),
    );
    const testConfig: ConventionConfig = {
      id: "rejected-test",
      name: "Rejected Test",
      description: "Test",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      protocol: protocol("rejected-test", [
        round("test-round", {
          triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
          handTree: testTree,
          seatFilter: isResponder(),
        }),
      ]),
    };

    const strategy = conventionToStrategy(testConfig);
    // 10 HCP hand → fails hcpMin(15), passes hcpMin(5) → weak-bid
    const h = hand("SA", "SK", "S5", "S3", "H5", "H3", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.treeInferenceData).toBeDefined();
    expect(result!.treeInferenceData!.rejectedConditions.length).toBeGreaterThan(0);

    // Should contain the rejected hcpMin(15) condition
    const rejectedHcp = result!.treeInferenceData!.rejectedConditions.find(e => e.type === "hcp-min");
    expect(rejectedHcp).toBeDefined();
    expect(rejectedHcp!.params).toEqual({ min: 15 });
  });

  test("is undefined when convention returns null (no match)", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const h = noMajorHand();
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const context: BiddingContext = {
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    // No match → null → no treeInferenceData
    expect(result).toBeNull();
  });

  test("includes negatable flag from condition", () => {
    // Use a convention where isBalanced (negatable: false) appears in the tree
    const strategy = conventionToStrategy(staymanConfig);
    const h = staymanResponder();
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const context: BiddingContext = {
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    if (result!.treeInferenceData) {
      // All entries should have negatable as boolean or undefined
      for (const entry of [
        ...result!.treeInferenceData.pathConditions,
        ...result!.treeInferenceData.rejectedConditions,
      ]) {
        expect(entry.negatable === undefined || typeof entry.negatable === "boolean").toBe(true);
      }
    }
  });

  test("skips auction conditions (only includes hand conditions)", () => {
    // Use a simple test convention with mixed conditions
    const testTree = handDecision(
      "hcp-check",
      hcpMin(10),
      intentBid("test-bid", "Test bid",
        { type: SemanticIntentType.Signoff, params: {} },
        () => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
      fallback("too-weak"),
    );
    const testConfig: ConventionConfig = {
      id: "inference-test",
      name: "Inference Test",
      description: "Test",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      protocol: protocol("inference-test", [
        round("test-round", {
          triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
          handTree: testTree,
          seatFilter: isResponder(),
        }),
      ]),
    };

    const strategy = conventionToStrategy(testConfig);
    // 15 HCP hand → matches hcpMin(10)
    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.treeInferenceData).toBeDefined();

    // pathConditions should contain hcpMin(10) inference
    const hcpEntry = result!.treeInferenceData!.pathConditions.find(e => e.type === "hcp-min");
    expect(hcpEntry).toBeDefined();
    expect(hcpEntry!.params).toEqual({ min: 10 });
  });
});

// ─── Phase 2b: ConventionStrategyOptions ─────────────────────

describe("conventionToStrategy — ConventionStrategyOptions", () => {
  test("beliefProvider is called and result threaded to pipeline", () => {
    let providerCalled = false;
    const strategy = conventionToStrategy(staymanConfig, {
      beliefProvider: () => {
        providerCalled = true;
        return undefined;
      },
    });
    const opener = staymanOpener();
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const context: BiddingContext = {
      hand: opener,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(opener),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(providerCalled).toBe(true);
  });

  test("beliefProvider exception does not crash strategy", () => {
    const strategy = conventionToStrategy(staymanConfig, {
      beliefProvider: () => {
        throw new Error("belief provider failed");
      },
    });
    const opener = staymanOpener();
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const context: BiddingContext = {
      hand: opener,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(opener),
      opponentConventionIds: [],
    };

    // Should not throw, should still produce a result
    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.call).toBeDefined();
  });

  test("options.ranker composes with config.rankCandidates", () => {
    const callLog: string[] = [];

    const testTree = handDecision(
      "hcp-check",
      hcpMin(8),
      intentBid("ask-bid", "Ask bid",
        { type: SemanticIntentType.AskForMajor, params: {} },
        () => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
      fallback("too-weak"),
    );

    const testConfig: ConventionConfig = {
      id: "ranker-compose-test",
      name: "Ranker Compose Test",
      description: "Test",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      protocol: protocol("ranker-compose-test", [
        round("test-round", {
          triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
          handTree: testTree,
          seatFilter: isResponder(),
        }),
      ]),
      rankCandidates: (cs) => {
        callLog.push("config-ranker");
        return cs;
      },
    };

    const strategy = conventionToStrategy(testConfig, {
      ranker: (cs) => {
        callLog.push("options-ranker");
        return cs;
      },
    });

    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    // Both rankers should have been called, config first, then options
    expect(callLog).toEqual(["config-ranker", "options-ranker"]);
  });
});
