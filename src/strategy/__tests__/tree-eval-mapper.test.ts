import { describe, test, expect } from "vitest";
import type { ConditionResult } from "../../conventions/core/types";
import { extractForkPoint, mapVisitedWithStructure, mapConditionResult } from "../bidding/tree-eval-mapper";
import type { TreePathEntry } from "../../contracts";
import type { DecisionNode } from "../../conventions/core/rule-tree";
import { decision, fallback } from "../../conventions/core/rule-tree";
import { intentBid } from "../../conventions/core/intent/intent-node";
import { SemanticIntentType } from "../../conventions/core/intent/semantic-intent";
import type { PathEntry } from "../../conventions/core/tree-evaluator";

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
