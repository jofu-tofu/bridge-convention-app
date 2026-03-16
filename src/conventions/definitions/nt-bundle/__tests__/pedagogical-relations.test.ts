import { describe, expect, it } from "vitest";
import { NT_PEDAGOGICAL_RELATIONS } from "../pedagogical-relations";
import type { PedagogicalRelation } from "../../../../core/contracts/teaching-projection";
import {
  RESPONDER_SURFACES,
  OPENER_STAYMAN_SURFACES,
  OPENER_TRANSFER_HEARTS_SURFACES,
  OPENER_TRANSFER_SPADES_SURFACES,
  STAYMAN_R3_AFTER_2H_SURFACES,
  STAYMAN_R3_AFTER_2S_SURFACES,
  STAYMAN_R3_AFTER_2D_SURFACES,
  TRANSFER_R3_HEARTS_SURFACES,
  TRANSFER_R3_SPADES_SURFACES,
  INTERFERENCE_REDOUBLE_SURFACE,
} from "../meaning-surfaces";

/** All meaning IDs defined in the 1NT bundle surfaces. */
function allMeaningIds(): Set<string> {
  const surfaces = [
    ...RESPONDER_SURFACES,
    ...OPENER_STAYMAN_SURFACES,
    ...OPENER_TRANSFER_HEARTS_SURFACES,
    ...OPENER_TRANSFER_SPADES_SURFACES,
    ...STAYMAN_R3_AFTER_2H_SURFACES,
    ...STAYMAN_R3_AFTER_2S_SURFACES,
    ...STAYMAN_R3_AFTER_2D_SURFACES,
    ...TRANSFER_R3_HEARTS_SURFACES,
    ...TRANSFER_R3_SPADES_SURFACES,
    INTERFERENCE_REDOUBLE_SURFACE,
  ];
  return new Set(surfaces.map((s) => s.meaningId));
}

/** Relation key for duplicate detection. */
function relationKey(r: PedagogicalRelation): string {
  return `${r.kind}:${r.a}:${r.b}`;
}

describe("NT pedagogical relations", () => {
  it("defines at least 10 relations", () => {
    expect(NT_PEDAGOGICAL_RELATIONS.length).toBeGreaterThanOrEqual(10);
  });

  it("references only meaning IDs that exist in the bundle surfaces", () => {
    const ids = allMeaningIds();
    for (const rel of NT_PEDAGOGICAL_RELATIONS) {
      expect(ids.has(rel.a), `unknown meaning ID in relation.a: ${rel.a}`).toBe(
        true,
      );
      expect(ids.has(rel.b), `unknown meaning ID in relation.b: ${rel.b}`).toBe(
        true,
      );
    }
  });

  it("has no duplicate relations", () => {
    const seen = new Set<string>();
    for (const rel of NT_PEDAGOGICAL_RELATIONS) {
      const key = relationKey(rel);
      expect(seen.has(key), `duplicate relation: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("is acyclic for directional relations (stronger-than, weaker-than)", () => {
    // Build directed adjacency: stronger-than(a, b) means a is stronger than b,
    // weaker-than(a, b) means b is stronger than a.
    const adj = new Map<string, Set<string>>();
    for (const rel of NT_PEDAGOGICAL_RELATIONS) {
      if (rel.kind === "stronger-than") {
        if (!adj.has(rel.a)) adj.set(rel.a, new Set());
        adj.get(rel.a)!.add(rel.b);
      } else if (rel.kind === "weaker-than") {
        if (!adj.has(rel.b)) adj.set(rel.b, new Set());
        adj.get(rel.b)!.add(rel.a);
      }
    }

    // Topological sort cycle detection via DFS coloring.
    const WHITE = 0,
      GRAY = 1,
      BLACK = 2;
    const color = new Map<string, number>();
    const nodes = new Set([...adj.keys()]);
    for (const [, targets] of adj) {
      for (const t of targets) nodes.add(t);
    }
    for (const n of nodes) color.set(n, WHITE);

    function hasCycle(node: string): boolean {
      color.set(node, GRAY);
      for (const neighbor of adj.get(node) ?? []) {
        const c = color.get(neighbor) ?? WHITE;
        if (c === GRAY) return true;
        if (c === WHITE && hasCycle(neighbor)) return true;
      }
      color.set(node, BLACK);
      return false;
    }

    for (const node of nodes) {
      if (color.get(node) === WHITE) {
        expect(hasCycle(node), `cycle detected involving ${node}`).toBe(false);
      }
    }
  });

  it("covers stayman, transfer, and natural-NT families via same-family relations", () => {
    const sameFamilyPairs = NT_PEDAGOGICAL_RELATIONS.filter(
      (r) => r.kind === "same-family",
    );
    const familyIds = new Set(sameFamilyPairs.flatMap((r) => [r.a, r.b]));

    // At least one stayman meaning in a same-family relation
    expect(
      [...familyIds].some((id) => id.startsWith("stayman:")),
      "same-family should include stayman meanings",
    ).toBe(true);

    // At least one transfer meaning in a same-family relation
    expect(
      [...familyIds].some((id) => id.startsWith("transfer:")),
      "same-family should include transfer meanings",
    ).toBe(true);

    // At least one natural-NT meaning in a same-family relation
    expect(
      [...familyIds].some((id) => id.startsWith("bridge:")),
      "same-family should include natural-NT meanings",
    ).toBe(true);
  });

  it("covers invite vs game strength via stronger-than/weaker-than", () => {
    const strengthRels = NT_PEDAGOGICAL_RELATIONS.filter(
      (r) => r.kind === "stronger-than" || r.kind === "weaker-than",
    );
    expect(
      strengthRels.length,
      "should have strength-ordering relations",
    ).toBeGreaterThanOrEqual(2);
  });

  it("covers fallback-of relationships", () => {
    const fallbacks = NT_PEDAGOGICAL_RELATIONS.filter(
      (r) => r.kind === "fallback-of",
    );
    expect(
      fallbacks.length,
      "should have at least one fallback-of relation",
    ).toBeGreaterThanOrEqual(1);
  });
});
