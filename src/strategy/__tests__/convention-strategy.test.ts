import { describe, test, expect, beforeEach } from "vitest";
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
import type { BiddingContext, ConditionResult } from "../../conventions/core/types";
import { registerConvention, clearRegistry } from "../../conventions/core/registry";
import { conventionToStrategy, extractForkPoint, mapVisitedWithStructure, mapConditionResult } from "../bidding/convention-strategy";
import type { TreePathEntry } from "../../shared/types";
import type { DecisionNode } from "../../conventions/core/rule-tree";
import { decision, fallback } from "../../conventions/core/rule-tree";
import { intentBid } from "../../conventions/core/intent/intent-node";
import { SemanticIntentType } from "../../conventions/core/intent/semantic-intent";
import type { PathEntry } from "../../conventions/core/tree-evaluator";
import type { ConventionOverlayPatch } from "../../conventions/core/overlay";
import { ConventionCategory } from "../../conventions/core/types";
import type { ConventionConfig } from "../../conventions/core/types";
import { protocol, round, semantic } from "../../conventions/core/protocol";
import { hcpMin, bidMade, isResponder } from "../../conventions/core/conditions";
import { handDecision } from "../../conventions/core/rule-tree";
import { buildAuction } from "../../engine/auction-helpers";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
  registerConvention(bergenConfig);
  registerConvention(weakTwosConfig);
  registerConvention(saycConfig);
});

describe("conventionToStrategy", () => {
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

describe("extractForkPoint", () => {
  function entry(
    nodeName: string,
    passed: boolean,
    parentNodeName: string | null,
    depth = 0,
  ): TreePathEntry {
    return { nodeName, passed, description: `${nodeName} desc`, depth, parentNodeName };
  }

  test("finds last adjacent pass/fail pair with same parent", () => {
    const entries: TreePathEntry[] = [
      entry("a", true, null, 0),
      entry("b", true, "a", 1),
      entry("c", false, "b", 2),   // rejected sibling
      entry("d", true, "b", 2),    // matched sibling
    ];
    const fork = extractForkPoint(entries);
    expect(fork).toBeDefined();
    expect(fork!.matched.nodeName).toBe("d");
    expect(fork!.rejected.nodeName).toBe("c");
  });

  test("returns undefined when all entries pass", () => {
    const entries: TreePathEntry[] = [
      entry("a", true, null, 0),
      entry("b", true, "a", 1),
    ];
    expect(extractForkPoint(entries)).toBeUndefined();
  });

  test("returns undefined for empty array", () => {
    expect(extractForkPoint([])).toBeUndefined();
  });

  test("ignores adjacent pass/fail from different parents", () => {
    const entries: TreePathEntry[] = [
      entry("a", true, null, 0),
      entry("b", false, "a", 1),  // parent is "a"
      entry("c", true, "x", 1),   // parent is "x" — different parent, not siblings
    ];
    // Only a/b are adjacent with different pass values, and they share parent null/a
    // b has parent "a", c has parent "x" — not siblings
    const fork = extractForkPoint(entries);
    // a(true, null) and b(false, "a") — different parents, not siblings
    expect(fork).toBeUndefined();
  });
});

// ─── Task 2: bestBranch marking when all branches fail ──────

describe("mapConditionResult — bestBranch marking", () => {
  function makeCond(name: string) {
    return { name, label: name, category: "hand" as const, test: () => false, describe: () => "desc" };
  }

  test("no branch marked as best when all branches have 0 passing conditions", () => {
    const cr: ConditionResult = {
      condition: makeCond("or-test"),
      passed: false,
      description: "all branches fail",
      branches: [
        {
          passed: false,
          results: [
            { condition: makeCond("c1"), passed: false, description: "c1 fail" },
          ],
        },
        {
          passed: false,
          results: [
            { condition: makeCond("c2"), passed: false, description: "c2 fail" },
          ],
        },
      ],
    };

    const detail = mapConditionResult(cr);
    // When all branches score 0, no branch should be marked as best
    for (const child of detail.children ?? []) {
      expect(child.isBestBranch).toBe(false);
    }
  });

  test("best branch marked correctly when one branch has passing conditions", () => {
    const cr: ConditionResult = {
      condition: makeCond("or-test"),
      passed: true,
      description: "one branch passes",
      branches: [
        {
          passed: false,
          results: [
            { condition: makeCond("c1"), passed: false, description: "c1 fail" },
          ],
        },
        {
          passed: true,
          results: [
            { condition: makeCond("c2"), passed: true, description: "c2 pass" },
          ],
        },
      ],
    };

    const detail = mapConditionResult(cr);
    expect(detail.children![0]!.isBestBranch).toBe(false);
    expect(detail.children![1]!.isBestBranch).toBe(true);
  });
});

// ─── Task 3: buildNodeInfo duplicate name handling ──────────

describe("mapVisitedWithStructure — duplicate DecisionNode names", () => {
  const alwaysTrue = { name: "always", label: "always", category: "hand" as const, test: () => true, describe: () => "yes" };
  const alwaysFalse = { name: "never", label: "never", category: "hand" as const, test: () => false, describe: () => "no" };

  test("two DecisionNodes sharing the same name get correct depth and parent info", () => {
    // Build tree with duplicate "check-suit" names at different depths:
    //   root (depth 0)
    //     YES -> middle (depth 1)
    //              YES -> "check-suit" at depth 2, parent "middle"
    //              NO  -> fallback
    //     NO  -> "check-suit" at depth 1, parent "root"
    //
    // DFS visits YES branch first: root -> middle -> checkSuitDeep (depth 2, parent "middle")
    // Then NO branch: checkSuitShallow (depth 1, parent "root")
    //
    // With name-keyed map, checkSuitShallow (visited second in DFS) overwrites checkSuitDeep.
    // If visited entries reference checkSuitDeep, lookup by name returns depth=1/parent="root"
    // instead of depth=2/parent="middle".
    const checkSuitDeep: DecisionNode = decision(
      "check-suit", alwaysTrue,
      intentBid("bid-deep", "Test: bid-deep", { type: SemanticIntentType.Signoff, params: {} }, () => ({ type: "pass" as const })),
      fallback("no match"),
    );
    const middle: DecisionNode = decision(
      "middle", alwaysTrue,
      checkSuitDeep,
      fallback("no match"),
    );
    const checkSuitShallow: DecisionNode = decision(
      "check-suit", alwaysFalse,
      intentBid("bid-shallow", "Test: bid-shallow", { type: SemanticIntentType.Signoff, params: {} }, () => ({ type: "pass" as const })),
      fallback("no match"),
    );
    const root: DecisionNode = decision(
      "root", alwaysTrue,
      middle,
      checkSuitShallow,
    );

    // Simulate visited: root(pass) -> middle(pass) -> checkSuitDeep(pass)
    // This is the YES path through the tree
    const visited: PathEntry[] = [
      { node: root, passed: true, description: "root passed" },
      { node: middle, passed: true, description: "middle passed" },
      { node: checkSuitDeep, passed: true, description: "check-suit passed" },
    ];

    const result = mapVisitedWithStructure(visited, root);

    // root: depth 0, parent null
    expect(result[0]!.depth).toBe(0);
    expect(result[0]!.parentNodeName).toBeNull();

    // middle: depth 1, parent "root"
    expect(result[1]!.depth).toBe(1);
    expect(result[1]!.parentNodeName).toBe("root");

    // checkSuitDeep: should be depth 2, parent "middle"
    // Bug: name-keyed map overwrites with checkSuitShallow (depth 1, parent "root")
    expect(result[2]!.depth).toBe(2);
    expect(result[2]!.parentNodeName).toBe("middle");
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
    registerConvention(testConfig);

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
