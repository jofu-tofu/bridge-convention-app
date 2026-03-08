import { describe, it, expect } from "vitest";
import type { RuleNode } from "../../core/tree/rule-tree";
import type { IntentNode } from "../../core/intent/intent-node";
import { saycProtocol } from "../../definitions/sayc/tree";
import { saycExplanations } from "../../definitions/sayc/explanations";

// ─── Helpers ─────────────────────────────────────────────────

/** Recursively collect all IntentNode leaves from a RuleNode tree. */
function collectIntentNodes(node: RuleNode): IntentNode[] {
  if (node.type === "intent") return [node];
  if (node.type === "fallback") return [];
  // DecisionNode
  return [
    ...collectIntentNodes(node.yes),
    ...collectIntentNodes(node.no),
  ];
}

/** Collect all IntentNodes from the SAYC protocol. */
function getAllProtocolIntentNodes(): IntentNode[] {
  const nodes: IntentNode[] = [];
  for (const round of saycProtocol.rounds) {
    for (const trigger of round.triggers) {
      // For semantic triggers with function handTrees, we need to evaluate them
      // But the protocol resolves hand trees at evaluation time via established context.
      // Instead, walk all trigger hand trees directly by getting established contexts.
      if (trigger.establishes) {
        const est = trigger.establishes;
        const handTree = typeof round.handTree === "function"
          ? round.handTree(est)
          : round.handTree;
        if (handTree) {
          nodes.push(...collectIntentNodes(handTree));
        }
      }
    }
  }
  return nodes;
}

// ─── Tests ───────────────────────────────────────────────────

describe("SAYC factory migration", () => {
  it("all IntentNode nodeIds have sayc/ prefix", () => {
    const nodes = getAllProtocolIntentNodes();
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      expect(node.nodeId).toMatch(/^sayc\//);
    }
  });

  it("no counter-based nodeIds exist (no intent- prefix)", () => {
    const nodes = getAllProtocolIntentNodes();
    for (const node of nodes) {
      expect(node.nodeId).not.toMatch(/^intent-\d+$/);
    }
  });

  it("all nodeIds contain a / separator", () => {
    const nodes = getAllProtocolIntentNodes();
    for (const node of nodes) {
      expect(node.nodeId).toContain("/");
    }
  });

  it("all nodeIds are unique within the protocol", () => {
    const nodes = getAllProtocolIntentNodes();
    const ids = nodes.map((n) => n.nodeId);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("protocol produces a non-trivial number of IntentNodes", () => {
    // SAYC has ~55+ intent nodes across openings, responses, rebids, competitive
    const nodes = getAllProtocolIntentNodes();
    expect(nodes.length).toBeGreaterThanOrEqual(40);
  });
});

describe("SAYC explanations", () => {
  it("convention section is populated with required fields", () => {
    expect(saycExplanations.convention).toBeDefined();
    expect(saycExplanations.convention!.purpose).toBeTruthy();
    expect(saycExplanations.convention!.whenToUse).toBeTruthy();
    expect(saycExplanations.convention!.whenNotToUse).toBeDefined();
    expect(saycExplanations.convention!.whenNotToUse!.length).toBeGreaterThan(0);
  });

  it("decisions section has entries", () => {
    expect(saycExplanations.decisions).toBeDefined();
    expect(Object.keys(saycExplanations.decisions!).length).toBeGreaterThan(0);
  });

  it("bids section has entries", () => {
    expect(saycExplanations.bids).toBeDefined();
    expect(Object.keys(saycExplanations.bids!).length).toBeGreaterThan(0);
  });

  it("each bid entry has whyThisBid", () => {
    expect(saycExplanations.bids).toBeDefined();
    for (const [key, bid] of Object.entries(saycExplanations.bids!)) {
      expect(bid.whyThisBid, `bid "${key}" missing whyThisBid`).toBeTruthy();
    }
  });

  it("each decision entry has whyThisMatters", () => {
    expect(saycExplanations.decisions).toBeDefined();
    for (const [key, dec] of Object.entries(saycExplanations.decisions!)) {
      expect(dec.whyThisMatters, `decision "${key}" missing whyThisMatters`).toBeTruthy();
    }
  });
});
