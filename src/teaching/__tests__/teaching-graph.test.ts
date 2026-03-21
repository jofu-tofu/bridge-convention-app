import { describe, expect, test } from "vitest";
import { buildTeachingGraph, findRelationsFor } from "../teaching-graph";
import type { TeachingRelation } from "../../core/contracts/teaching-projection";

describe("buildTeachingGraph", () => {
  test("indexes relations for O(1) lookup by meaning ref", () => {
    const relations: TeachingRelation[] = [
      { kind: "near-miss-of", a: "stayman:ask-major", b: "transfer:to-hearts" },
      { kind: "same-family", a: "stayman:ask-major", b: "transfer:to-spades" },
    ];

    const graph = buildTeachingGraph(relations);

    // Both relations should be findable via "stayman:ask-major"
    const forStayman = findRelationsFor(graph, "stayman:ask-major");
    expect(forStayman).toHaveLength(2);

    // One relation findable via "transfer:to-hearts"
    const forTransferH = findRelationsFor(graph, "transfer:to-hearts");
    expect(forTransferH).toHaveLength(1);
    expect(forTransferH[0]!.kind).toBe("near-miss-of");

    // One relation findable via "transfer:to-spades"
    const forTransferS = findRelationsFor(graph, "transfer:to-spades");
    expect(forTransferS).toHaveLength(1);
    expect(forTransferS[0]!.kind).toBe("same-family");
  });

  test("returns empty array for unknown meaning ref", () => {
    const graph = buildTeachingGraph([
      { kind: "near-miss-of", a: "stayman:ask-major", b: "transfer:to-hearts" },
    ]);

    const result = findRelationsFor(graph, "unknown:meaning");
    expect(result).toEqual([]);
  });

  test("handles empty relations array", () => {
    const graph = buildTeachingGraph([]);

    const result = findRelationsFor(graph, "stayman:ask-major");
    expect(result).toEqual([]);
  });

  test("same relation appears under both a and b refs", () => {
    const relation: TeachingRelation = {
      kind: "stronger-than",
      a: "bridge:to-3nt",
      b: "bridge:nt-invite",
    };
    const graph = buildTeachingGraph([relation]);

    const forA = findRelationsFor(graph, "bridge:to-3nt");
    const forB = findRelationsFor(graph, "bridge:nt-invite");

    expect(forA).toHaveLength(1);
    expect(forB).toHaveLength(1);
    expect(forA[0]).toBe(forB[0]); // Same object reference
  });
});
