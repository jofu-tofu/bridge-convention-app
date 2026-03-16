import { describe, it, expect } from "vitest";
import {
  mergeFactCatalogs,
  mergeExplanationEntries,
  mergePedagogicalRelations,
  mergeAlternativeGroups,
} from "../registry-merger";
import type { FactCatalogExtension } from "../../../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../../../core/contracts/explanation-catalog";
import type { ModulePackage } from "../../modules";
import type { PedagogicalRelation } from "../../../../core/contracts/teaching-projection";

// ─── Helpers ────────────────────────────────────────────────

function makeFactExtension(
  defs: { id: string; description?: string }[],
): FactCatalogExtension {
  return {
    definitions: defs.map((d) => ({
      id: d.id,
      layer: "module-derived" as const,
      world: "acting-hand" as const,
      description: d.description ?? d.id,
      valueType: "boolean" as const,
    })),
    evaluators: new Map(),
  };
}

function makeExplanation(id: string): ExplanationEntry {
  return {
    explanationId: id,
    templateKey: `tmpl.${id}`,
    preferredLevel: "semantic",
    roles: ["supporting"],
  };
}

function makePackage(
  moduleId: string,
  overrides: Partial<ModulePackage> = {},
): ModulePackage {
  return {
    moduleId,
    exports: {
      surfaces: [],
      ...overrides.exports,
    },
    runtime: {
      ...overrides.runtime,
    },
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe("mergeFactCatalogs", () => {
  it("returns base catalog when no extensions given", () => {
    const catalog = mergeFactCatalogs([]);
    // Should have shared facts from the base
    expect(catalog.definitions.length).toBeGreaterThan(0);
    expect(catalog.definitions.some((d) => d.id === "hand.hcp")).toBe(true);
  });

  it("merges extension definitions into the catalog", () => {
    const ext = makeFactExtension([
      { id: "module.test.flag", description: "Test flag" },
    ]);
    const catalog = mergeFactCatalogs([ext]);
    expect(catalog.definitions.some((d) => d.id === "module.test.flag")).toBe(
      true,
    );
  });

  it("merges multiple extensions", () => {
    const ext1 = makeFactExtension([{ id: "module.a.fact" }]);
    const ext2 = makeFactExtension([{ id: "module.b.fact" }]);
    const catalog = mergeFactCatalogs([ext1, ext2]);
    expect(catalog.definitions.some((d) => d.id === "module.a.fact")).toBe(true);
    expect(catalog.definitions.some((d) => d.id === "module.b.fact")).toBe(true);
  });
});

describe("mergeExplanationEntries", () => {
  it("returns empty catalog when no entries given", () => {
    const catalog = mergeExplanationEntries([]);
    expect(catalog.entries).toEqual([]);
    expect(catalog.version).toBe("1.0.0");
  });

  it("collects entries into the catalog", () => {
    const entries = [makeExplanation("exp-1"), makeExplanation("exp-2")];
    const catalog = mergeExplanationEntries(entries);
    expect(catalog.entries).toHaveLength(2);
    expect(catalog.entries[0]!.explanationId).toBe("exp-1");
  });
});

describe("mergePedagogicalRelations", () => {
  it("returns empty array when packages have no relations", () => {
    const result = mergePedagogicalRelations([makePackage("a")]);
    expect(result).toEqual([]);
  });

  it("collects relations from all packages", () => {
    const relA: PedagogicalRelation = {
      kind: "same-family",
      a: "bid-1",
      b: "bid-2",
    };
    const relB: PedagogicalRelation = {
      kind: "stronger-than",
      a: "bid-3",
      b: "bid-4",
    };
    const pkgA = makePackage("a", {
      exports: { surfaces: [], pedagogicalRelations: [relA] },
    });
    const pkgB = makePackage("b", {
      exports: { surfaces: [], pedagogicalRelations: [relB] },
    });
    const result = mergePedagogicalRelations([pkgA, pkgB]);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(relA);
    expect(result).toContainEqual(relB);
  });
});

describe("mergeAlternativeGroups", () => {
  it("returns empty array (packages do not yet carry alternatives)", () => {
    const result = mergeAlternativeGroups([makePackage("a")]);
    expect(result).toEqual([]);
  });
});
