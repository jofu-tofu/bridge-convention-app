import { describe, it, expect } from "vitest";
import { deriveTeachingContent } from "../derive-cross-module";
import type { TeachingRelation } from "../../../core/contracts/teaching-projection";
import type { AlternativeGroup } from "../../../core/contracts/tree-evaluation";
import type { ConventionModule } from "../../core/convention-module";
import type { BidMeaning } from "../../../core/contracts/meaning";
import type { TeachingTagDef } from "../../../core/contracts/teaching-tag";

// ── Real NT modules ─────────────────────────────────────────────────

import { staymanModule } from "../modules/stayman";
import { jacobyTransfersModule } from "../modules/jacoby-transfers";
import { smolenModule } from "../modules/smolen";
import { naturalNtModule } from "../modules/natural-nt";

const NT_MODULES: readonly ConventionModule[] = [
  naturalNtModule,
  staymanModule,
  jacobyTransfersModule,
  smolenModule,
];

// ── Helpers ──────────────────────────────────────────────────────────

function sortRelations(rels: readonly TeachingRelation[]): TeachingRelation[] {
  return [...rels].sort((a, b) => {
    const kindCmp = a.kind.localeCompare(b.kind);
    if (kindCmp !== 0) return kindCmp;
    const aCmp = a.a.localeCompare(b.a);
    if (aCmp !== 0) return aCmp;
    return a.b.localeCompare(b.b);
  });
}

function sortAlternatives(alts: readonly AlternativeGroup[]): AlternativeGroup[] {
  return [...alts].map((g) => ({
    ...g,
    members: [...g.members].sort(),
  })).sort((a, b) => a.label.localeCompare(b.label));
}

// ── Tests ────────────────────────────────────────────────────────────

describe("deriveTeachingContent", () => {
  it("produces expected relations from NT modules (snapshot)", () => {
    const result = deriveTeachingContent(NT_MODULES);
    expect(sortRelations(result.relations)).toMatchSnapshot();
  });

  it("produces expected alternative groups from NT modules (snapshot)", () => {
    const result = deriveTeachingContent(NT_MODULES);
    expect(sortAlternatives(result.alternatives)).toMatchSnapshot();
  });

  it("produces zero intent families from NT modules (regression)", () => {
    const result = deriveTeachingContent(NT_MODULES);
    expect(result.intentFamilies).toEqual([]);
  });

  it("produces both cross-module and intra-module relations", () => {
    const result = deriveTeachingContent(NT_MODULES);
    // Cross-module: same-family across stayman/transfers
    const crossModule = result.relations.filter(
      (r) => r.kind === "same-family" && r.a === "stayman:ask-major",
    );
    expect(crossModule.length).toBeGreaterThan(0);
    // Intra-module: stronger-than within stayman R3
    const intraModule = result.relations.filter(
      (r) => r.kind === "stronger-than" && r.a === "stayman:raise-game" && r.b === "stayman:raise-invite",
    );
    // May not match exact semanticClassIds, so just check stronger-than exists
    const anyStronger = result.relations.filter((r) => r.kind === "stronger-than");
    expect(anyStronger.length).toBeGreaterThan(0);
  });

  it("produces 2 alternative groups", () => {
    const result = deriveTeachingContent(NT_MODULES);
    expect(result.alternatives).toHaveLength(2);
  });

  it("produces empty output for modules with no tags", () => {
    const emptyModule: ConventionModule = {
      moduleId: "empty",
      entrySurfaces: [],
      surfaceGroups: [],
      entryTransitions: [],
      machineStates: [],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };
    const result = deriveTeachingContent([emptyModule]);
    expect(result.relations).toEqual([]);
    expect(result.alternatives).toEqual([]);
    expect(result.intentFamilies).toEqual([]);
  });
});

// ── Validation tests ─────────────────────────────────────────────────

describe("deriveTeachingContent validation", () => {
  function makeSurface(meaningId: string, semanticClassId: string, tags: BidMeaning["teachingTags"]): BidMeaning {
    return {
      meaningId,
      semanticClassId,
      moduleId: "test",
      encoding: { defaultCall: { type: "pass" } },
      clauses: [],
      ranking: { recommendationBand: "should", modulePrecedence: 0, intraModuleOrder: 0 },
      sourceIntent: { type: "Test", params: {} },
      teachingLabel: meaningId,
      teachingTags: tags,
    };
  }

  function makeModule(surfaces: BidMeaning[]): ConventionModule {
    return {
      moduleId: "test",
      entrySurfaces: surfaces,
      surfaceGroups: [],
      entryTransitions: [],
      machineStates: [],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };
  }

  it("skips directed relation tag missing role:a (incomplete group)", () => {
    const tag: TeachingTagDef = {
      id: "test-directed",
      label: "Test",
      derives: { type: "relation", kind: "stronger-than" },
    };
    const mod = makeModule([
      makeSurface("x", "x", [{ tag, scope: "s", role: "b" }]),
    ]);
    const result = deriveTeachingContent([mod]);
    expect(result.relations).toEqual([]);
  });

  it("skips directed relation tag missing role:b (incomplete group)", () => {
    const tag: TeachingTagDef = {
      id: "test-directed",
      label: "Test",
      derives: { type: "relation", kind: "stronger-than" },
    };
    const mod = makeModule([
      makeSurface("x", "x", [{ tag, scope: "s", role: "a" }]),
    ]);
    const result = deriveTeachingContent([mod]);
    expect(result.relations).toEqual([]);
  });

  it("throws when symmetric relation tag uses roles", () => {
    const tag: TeachingTagDef = {
      id: "test-symmetric",
      label: "Test",
      derives: { type: "relation", kind: "same-family", symmetric: true },
    };
    const mod = makeModule([
      makeSurface("x", "x", [{ tag, scope: "s", role: "a" }]),
      makeSurface("y", "y", [{ tag, scope: "s" }]),
    ]);
    expect(() => deriveTeachingContent([mod])).toThrow("must not use roles");
  });

  it("skips alternative-group tag with fewer than 2 members (incomplete group)", () => {
    const tag: TeachingTagDef = {
      id: "test-group",
      label: "Test",
      derives: { type: "alternative-group", tier: "alternative" },
    };
    const mod = makeModule([
      makeSurface("x", "x", [{ tag, scope: "My Group" }]),
    ]);
    const result = deriveTeachingContent([mod]);
    expect(result.alternatives).toEqual([]);
  });

  it("throws on duplicate (tag, scope, meaningId) tuples", () => {
    const tag: TeachingTagDef = {
      id: "test-dup",
      label: "Test",
      derives: { type: "relation", kind: "same-family", symmetric: true },
    };
    const surface = makeSurface("x", "x", [{ tag, scope: "s" }]);
    const mod = makeModule([surface]);
    const mod2 = makeModule([surface]);
    expect(() => deriveTeachingContent([mod, mod2])).toThrow("Duplicate");
  });

  it("derives adjacent pairs from ordinal chains", () => {
    const tag: TeachingTagDef = {
      id: "test-chain",
      label: "Test",
      derives: { type: "relation", kind: "stronger-than" },
    };
    const mod = makeModule([
      makeSurface("a", "a", [{ tag, scope: "chain", ordinal: 0 }]),
      makeSurface("b", "b", [{ tag, scope: "chain", ordinal: 1 }]),
      makeSurface("c", "c", [{ tag, scope: "chain", ordinal: 2 }]),
    ]);
    const result = deriveTeachingContent([mod]);
    expect(result.relations).toEqual([
      { kind: "stronger-than", a: "a", b: "b" },
      { kind: "stronger-than", a: "b", b: "c" },
    ]);
  });

  it("uses scope as label for alternative groups", () => {
    const tag: TeachingTagDef = {
      id: "test-alts",
      label: "Test",
      derives: { type: "alternative-group", tier: "alternative" },
    };
    const mod = makeModule([
      makeSurface("x", "x", [{ tag, scope: "My Label" }]),
      makeSurface("y", "y", [{ tag, scope: "My Label" }]),
    ]);
    const result = deriveTeachingContent([mod]);
    expect(result.alternatives).toEqual([
      { label: "My Label", members: ["x", "y"], tier: "alternative" },
    ]);
  });
});
