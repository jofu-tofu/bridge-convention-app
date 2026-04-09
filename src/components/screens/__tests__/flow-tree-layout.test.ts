import { describe, it, expect } from "vitest";
import type { FlowTreeNode } from "../../../service/response-types";
import { layoutFlowTree, NODE_W, NODE_H, SIBLING_GAP, DEPTH_GAP } from "../convention-canvas/flow-tree-layout";

function makeNode(overrides: Partial<FlowTreeNode> = {}): FlowTreeNode {
  return {
    id: "test-node",
    call: null,
    callDisplay: null,
    turn: null,
    label: "Test",
    moduleId: null,
    moduleDisplayName: null,
    meaningId: null,
    children: [],
    depth: 0,
    recommendation: null,
    disclosure: null,
    explanationText: null,
    clauses: [],
    ...overrides,
  };
}

describe("layoutFlowTree", () => {
  it("single node: produces 1 node, 0 edges", () => {
    const root = makeNode({ id: "root" });
    const result = layoutFlowTree(root);

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
    expect(result.nodes[0]!.width).toBe(NODE_W);
    expect(result.nodes[0]!.height).toBe(NODE_H);
    expect(result.nodes[0]!.parentId).toBeNull();
    expect(result.nodes[0]!.depth).toBe(0);
  });

  it("balanced tree (2 children): positions children side by side", () => {
    const root = makeNode({
      id: "root",
      children: [
        makeNode({ id: "left", depth: 1 }),
        makeNode({ id: "right", depth: 1 }),
      ],
    });
    const result = layoutFlowTree(root);

    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);

    const rootNode = result.nodes.find((n) => n.id === "root")!;
    const leftNode = result.nodes.find((n) => n.id === "left")!;
    const rightNode = result.nodes.find((n) => n.id === "right")!;

    // Root is above children
    expect(rootNode.y).toBeLessThan(leftNode.y);
    // Children at same Y
    expect(leftNode.y).toBe(rightNode.y);
    // Left child is to the left of right child
    expect(leftNode.x).toBeLessThan(rightNode.x);
    // Children are one level below root
    expect(leftNode.y).toBe(rootNode.y + NODE_H + DEPTH_GAP);
    // Both children have root as parent
    expect(leftNode.parentId).toBe("root");
    expect(rightNode.parentId).toBe("root");
  });

  it("deep chain (depth 4): nodes stack vertically", () => {
    const chain = makeNode({
      id: "d0",
      children: [makeNode({
        id: "d1",
        depth: 1,
        children: [makeNode({
          id: "d2",
          depth: 2,
          children: [makeNode({ id: "d3", depth: 3 })],
        })],
      })],
    });
    const result = layoutFlowTree(chain);

    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);

    // All nodes at same x (single chain, no siblings)
    const xs = result.nodes.map((n) => n.x);
    expect(new Set(xs).size).toBe(1);

    // Y increases with depth
    for (let i = 1; i < result.nodes.length; i++) {
      expect(result.nodes[i]!.y).toBeGreaterThan(result.nodes[i - 1]!.y);
    }

    expect(result.totalHeight).toBe(4 * NODE_H + 3 * DEPTH_GAP);
  });

  it("wide tree (5 siblings): total width accommodates all", () => {
    const children = Array.from({ length: 5 }, (_, i) =>
      makeNode({ id: `child-${i}`, depth: 1 }),
    );
    const root = makeNode({ id: "root", children });
    const result = layoutFlowTree(root);

    expect(result.nodes).toHaveLength(6);
    expect(result.edges).toHaveLength(5);

    const childNodes = result.nodes.filter((n) => n.id.startsWith("child-"));
    // All children at same Y
    const ys = new Set(childNodes.map((n) => n.y));
    expect(ys.size).toBe(1);

    // Children ordered left to right
    for (let i = 1; i < childNodes.length; i++) {
      expect(childNodes[i]!.x).toBeGreaterThan(childNodes[i - 1]!.x);
    }

    // Sibling spacing
    const expectedWidth = 5 * NODE_W + 4 * SIBLING_GAP;
    expect(result.totalWidth).toBe(expectedWidth);
  });

  it("edge paths are valid SVG cubic beziers", () => {
    const root = makeNode({
      id: "root",
      children: [makeNode({ id: "child", depth: 1 })],
    });
    const result = layoutFlowTree(root);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.path).toMatch(/^M \d+ \d+ C \d+/);
  });
});
