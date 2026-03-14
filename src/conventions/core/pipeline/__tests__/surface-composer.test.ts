import { describe, it, expect } from "vitest";
import { composeSurfaces, mergeUpstreamProvenance } from "../surface-composer";
import type { CandidateTransform } from "../../../../core/contracts/meaning";
import type { MeaningSurface } from "../../../../core/contracts/meaning-surface";
import type { ArbitrationResult, SurfaceCompositionDiagnostic } from "../../../../core/contracts/module-surface";
import { BidSuit } from "../../../../engine/types";

// ─── Helpers ───────────────────────────────────────────────

function makeSurface(overrides?: Partial<MeaningSurface>): MeaningSurface {
  return {
    meaningId: "test:meaning",
    moduleId: "test",
    encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
    clauses: [],
    ranking: { recommendationBand: "should", specificity: 1, modulePrecedence: 0, intraModuleOrder: 0 },
    sourceIntent: { type: "test-intent", params: {} },
    ...overrides,
  };
}

function makeSuppress(targetId: string, id = "t1"): CandidateTransform {
  return {
    transformId: id,
    kind: "suppress",
    targetId,
    sourceModuleId: "interference",
    reason: `Suppress ${targetId}`,
  };
}

// ─── composeSurfaces ───────────────────────────────────────

describe("composeSurfaces", () => {
  it("returns all surfaces unchanged when no transforms provided", () => {
    const surfaces = [makeSurface({ meaningId: "a" }), makeSurface({ meaningId: "b" })];
    const result = composeSurfaces(surfaces);

    expect(result.composedSurfaces).toEqual(surfaces);
    expect(result.appliedTransforms).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("returns all surfaces unchanged with empty transforms array", () => {
    const surfaces = [makeSurface({ meaningId: "a" })];
    const result = composeSurfaces(surfaces, []);

    expect(result.composedSurfaces).toEqual(surfaces);
    expect(result.appliedTransforms).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("suppress by meaningId removes matching surface", () => {
    const surfaces = [
      makeSurface({ meaningId: "keep" }),
      makeSurface({ meaningId: "remove" }),
    ];
    const result = composeSurfaces(surfaces, [makeSuppress("remove")]);

    expect(result.composedSurfaces).toHaveLength(1);
    expect(result.composedSurfaces[0]!.meaningId).toBe("keep");
  });

  it("suppress by semanticClassId removes matching surface", () => {
    const surfaces = [
      makeSurface({ meaningId: "a", semanticClassId: "bridge:class" }),
      makeSurface({ meaningId: "b" }),
    ];
    const result = composeSurfaces(surfaces, [makeSuppress("bridge:class")]);

    expect(result.composedSurfaces).toHaveLength(1);
    expect(result.composedSurfaces[0]!.meaningId).toBe("b");
  });

  it("suppress targeting non-existent ID is a no-op with diagnostic", () => {
    const surfaces = [makeSurface({ meaningId: "a" })];
    const result = composeSurfaces(surfaces, [makeSuppress("nonexistent")]);

    expect(result.composedSurfaces).toHaveLength(1);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.level).toBe("warn");
    expect(result.diagnostics[0]!.message).toContain("nonexistent");
  });

  it("multiple suppress transforms compose (union)", () => {
    const surfaces = [
      makeSurface({ meaningId: "a" }),
      makeSurface({ meaningId: "b" }),
      makeSurface({ meaningId: "c" }),
    ];
    const result = composeSurfaces(surfaces, [
      makeSuppress("a", "t1"),
      makeSuppress("c", "t2"),
    ]);

    expect(result.composedSurfaces).toHaveLength(1);
    expect(result.composedSurfaces[0]!.meaningId).toBe("b");
  });

  it("records appliedTransforms with affectedMeaningIds", () => {
    const surfaces = [
      makeSurface({ meaningId: "target" }),
      makeSurface({ meaningId: "safe" }),
    ];
    const result = composeSurfaces(surfaces, [makeSuppress("target")]);

    expect(result.appliedTransforms).toHaveLength(1);
    expect(result.appliedTransforms[0]!.kind).toBe("suppress");
    expect(result.appliedTransforms[0]!.targetId).toBe("target");
    expect(result.appliedTransforms[0]!.affectedMeaningIds).toEqual(["target"]);
  });

  it("suppress by semanticClassId records all affected meaningIds", () => {
    const surfaces = [
      makeSurface({ meaningId: "a", semanticClassId: "bridge:class" }),
      makeSurface({ meaningId: "b", semanticClassId: "bridge:class" }),
      makeSurface({ meaningId: "c" }),
    ];
    const result = composeSurfaces(surfaces, [makeSuppress("bridge:class")]);

    expect(result.composedSurfaces).toHaveLength(1);
    expect(result.appliedTransforms).toHaveLength(1);
    expect(result.appliedTransforms[0]!.affectedMeaningIds).toEqual(["a", "b"]);
  });

  it("logs diagnostic for unrecognized transform kind", () => {
    const surfaces = [makeSurface()];
    // Force a truly unrecognized kind via type assertion
    const unknownTransform = {
      transformId: "t1",
      kind: "frobnicate" as unknown as "suppress",
      targetId: "x",
      sourceModuleId: "mod",
      reason: "unknown",
    } satisfies CandidateTransform;
    const result = composeSurfaces(surfaces, [unknownTransform]);

    expect(result.composedSurfaces).toEqual(surfaces);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.level).toBe("info");
    expect(result.diagnostics[0]!.message).toContain("frobnicate");
  });

  it("emits info diagnostic for each successfully suppressed surface", () => {
    const surfaces = [
      makeSurface({ meaningId: "suppressed-one" }),
      makeSurface({ meaningId: "suppressed-two", semanticClassId: "bridge:class" }),
      makeSurface({ meaningId: "kept" }),
    ];
    const result = composeSurfaces(surfaces, [
      makeSuppress("suppressed-one", "t1"),
      makeSuppress("bridge:class", "t2"),
    ]);

    expect(result.composedSurfaces).toHaveLength(1);

    const suppressDiags = result.diagnostics.filter(
      (d) => d.message.includes("Suppressed"),
    );
    expect(suppressDiags).toHaveLength(2);
    expect(suppressDiags.every((d) => d.level === "info")).toBe(true);
    expect(suppressDiags[0]!.message).toContain("suppressed-one");
    expect(suppressDiags[0]!.message).toContain("t1");
    expect(suppressDiags[1]!.message).toContain("bridge:class");
    expect(suppressDiags[1]!.message).toContain("t2");
  });

  it("emits info diagnostic for remap transforms with remap details", () => {
    const surfaces = [makeSurface({ meaningId: "a" })];
    const remapTransform: CandidateTransform = {
      transformId: "remap-1",
      kind: "remap",
      targetId: "a",
      sourceModuleId: "mod",
      reason: "Change encoding",
      newCall: { type: "bid", level: 3, strain: BidSuit.Clubs },
    };
    const result = composeSurfaces(surfaces, [remapTransform]);

    // Remap is now handled — surface encoding should change
    expect(result.composedSurfaces).toHaveLength(1);
    expect(result.composedSurfaces[0]!.encoding.defaultCall).toEqual({
      type: "bid",
      level: 3,
      strain: BidSuit.Clubs,
    });
    expect(result.appliedTransforms).toHaveLength(1);
    expect(result.appliedTransforms[0]!.kind).toBe("remap");

    const remapDiags = result.diagnostics.filter(
      (d) => d.message.includes("Remap"),
    );
    expect(remapDiags).toHaveLength(1);
    expect(remapDiags[0]!.level).toBe("info");
    expect(remapDiags[0]!.message).toContain("remap-1");
  });

  // ─── inject transforms ─────────────────────────────────────

  it("inject transform adds surface to composed set", () => {
    const existing = [makeSurface({ meaningId: "existing" })];
    const injectedSurface = makeSurface({
      meaningId: "injected:new",
      moduleId: "overlay-mod",
      encoding: { defaultCall: { type: "bid", level: 4, strain: BidSuit.Hearts } },
    });
    const injectTransform: CandidateTransform = {
      transformId: "inject-1",
      kind: "inject",
      targetId: "injected:new",
      sourceModuleId: "overlay-mod",
      reason: "Inject competitive bid",
      surface: injectedSurface,
    };

    const result = composeSurfaces(existing, [injectTransform]);

    expect(result.composedSurfaces).toHaveLength(2);
    expect(result.composedSurfaces[0]!.meaningId).toBe("existing");
    expect(result.composedSurfaces[1]!.meaningId).toBe("injected:new");
    expect(result.appliedTransforms).toHaveLength(1);
    expect(result.appliedTransforms[0]!.kind).toBe("inject");
    expect(result.appliedTransforms[0]!.targetId).toBe("injected:new");
    expect(result.appliedTransforms[0]!.affectedMeaningIds).toEqual(["injected:new"]);
  });

  it("inject transform without surface field emits diagnostic", () => {
    const existing = [makeSurface({ meaningId: "existing" })];
    const badInject: CandidateTransform = {
      transformId: "inject-bad",
      kind: "inject",
      targetId: "phantom",
      sourceModuleId: "overlay-mod",
      reason: "Missing surface payload",
      // no surface field
    };

    const result = composeSurfaces(existing, [badInject]);

    // Should not add anything
    expect(result.composedSurfaces).toHaveLength(1);
    expect(result.composedSurfaces[0]!.meaningId).toBe("existing");
    expect(result.appliedTransforms).toHaveLength(0);

    // Should emit a warning
    const warnDiags = result.diagnostics.filter((d) => d.level === "warn");
    expect(warnDiags).toHaveLength(1);
    expect(warnDiags[0]!.message).toContain("inject-bad");
    expect(warnDiags[0]!.message).toContain("surface");
  });

  // ─── remap transforms ──────────────────────────────────────

  it("remap transform changes encoding on matching surface", () => {
    const surfaces = [
      makeSurface({
        meaningId: "remap:target",
        encoding: { defaultCall: { type: "bid", level: 1, strain: BidSuit.Diamonds } },
      }),
      makeSurface({ meaningId: "untouched" }),
    ];
    const remapTransform: CandidateTransform = {
      transformId: "remap-enc",
      kind: "remap",
      targetId: "remap:target",
      sourceModuleId: "override-mod",
      reason: "Transfer encoding change",
      newCall: { type: "bid", level: 2, strain: BidSuit.Diamonds },
    };

    const result = composeSurfaces(surfaces, [remapTransform]);

    expect(result.composedSurfaces).toHaveLength(2);
    const remapped = result.composedSurfaces.find((s) => s.meaningId === "remap:target")!;
    expect(remapped.encoding.defaultCall).toEqual({
      type: "bid",
      level: 2,
      strain: BidSuit.Diamonds,
    });
    // Untouched surface unchanged
    const kept = result.composedSurfaces.find((s) => s.meaningId === "untouched")!;
    expect(kept.encoding.defaultCall).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });
    expect(result.appliedTransforms).toHaveLength(1);
    expect(result.appliedTransforms[0]!.kind).toBe("remap");
    expect(result.appliedTransforms[0]!.affectedMeaningIds).toEqual(["remap:target"]);
  });

  it("remap transform by semanticClassId applies to all matching surfaces", () => {
    const surfaces = [
      makeSurface({
        meaningId: "a",
        semanticClassId: "bridge:transfer",
        encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Diamonds } },
      }),
      makeSurface({
        meaningId: "b",
        semanticClassId: "bridge:transfer",
        encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Hearts } },
      }),
      makeSurface({ meaningId: "c" }),
    ];
    const remapTransform: CandidateTransform = {
      transformId: "remap-class",
      kind: "remap",
      targetId: "bridge:transfer",
      sourceModuleId: "override-mod",
      reason: "Remap all transfers",
      remapTo: {
        defaultCall: { type: "bid", level: 3, strain: BidSuit.NoTrump },
      },
    };

    const result = composeSurfaces(surfaces, [remapTransform]);

    expect(result.composedSurfaces).toHaveLength(3);
    const remappedA = result.composedSurfaces.find((s) => s.meaningId === "a")!;
    const remappedB = result.composedSurfaces.find((s) => s.meaningId === "b")!;
    expect(remappedA.encoding.defaultCall).toEqual({ type: "bid", level: 3, strain: BidSuit.NoTrump });
    expect(remappedB.encoding.defaultCall).toEqual({ type: "bid", level: 3, strain: BidSuit.NoTrump });
    expect(result.appliedTransforms).toHaveLength(1);
    expect(result.appliedTransforms[0]!.affectedMeaningIds).toEqual(["a", "b"]);
  });

  it("remap on non-existent target emits warning diagnostic", () => {
    const surfaces = [makeSurface({ meaningId: "a" })];
    const remapTransform: CandidateTransform = {
      transformId: "remap-miss",
      kind: "remap",
      targetId: "nonexistent:target",
      sourceModuleId: "mod",
      reason: "Remap nothing",
      newCall: { type: "bid", level: 3, strain: BidSuit.Spades },
    };

    const result = composeSurfaces(surfaces, [remapTransform]);

    expect(result.composedSurfaces).toHaveLength(1);
    expect(result.composedSurfaces[0]!.meaningId).toBe("a");
    expect(result.appliedTransforms).toHaveLength(0);

    const warnDiags = result.diagnostics.filter((d) => d.level === "warn");
    expect(warnDiags).toHaveLength(1);
    expect(warnDiags[0]!.message).toContain("remap-miss");
    expect(warnDiags[0]!.message).toContain("nonexistent:target");
  });

  // ─── mixed transforms ──────────────────────────────────────

  it("mixed transforms (suppress + inject + remap) compose correctly", () => {
    const surfaces = [
      makeSurface({
        meaningId: "keep",
        encoding: { defaultCall: { type: "bid", level: 1, strain: BidSuit.Clubs } },
      }),
      makeSurface({ meaningId: "remove" }),
      makeSurface({
        meaningId: "remap-me",
        encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Diamonds } },
      }),
    ];

    const injectedSurface = makeSurface({
      meaningId: "fresh:inject",
      encoding: { defaultCall: { type: "bid", level: 4, strain: BidSuit.Spades } },
    });

    const transforms: CandidateTransform[] = [
      makeSuppress("remove", "suppress-1"),
      {
        transformId: "inject-1",
        kind: "inject",
        targetId: "fresh:inject",
        sourceModuleId: "overlay",
        reason: "Add competitive bid",
        surface: injectedSurface,
      },
      {
        transformId: "remap-1",
        kind: "remap",
        targetId: "remap-me",
        sourceModuleId: "override",
        reason: "Change call",
        newCall: { type: "bid", level: 3, strain: BidSuit.Diamonds },
      },
    ];

    const result = composeSurfaces(surfaces, transforms);

    // "remove" suppressed, "remap-me" remapped, "fresh:inject" injected
    expect(result.composedSurfaces).toHaveLength(3);

    const ids = result.composedSurfaces.map((s) => s.meaningId);
    expect(ids).toContain("keep");
    expect(ids).toContain("remap-me");
    expect(ids).toContain("fresh:inject");
    expect(ids).not.toContain("remove");

    // Verify remap applied
    const remapped = result.composedSurfaces.find((s) => s.meaningId === "remap-me")!;
    expect(remapped.encoding.defaultCall).toEqual({
      type: "bid",
      level: 3,
      strain: BidSuit.Diamonds,
    });

    // Verify injected surface is intact
    const injected = result.composedSurfaces.find((s) => s.meaningId === "fresh:inject")!;
    expect(injected.encoding.defaultCall).toEqual({
      type: "bid",
      level: 4,
      strain: BidSuit.Spades,
    });

    // All three transform types recorded
    expect(result.appliedTransforms).toHaveLength(3);
    const kinds = result.appliedTransforms.map((t) => t.kind);
    expect(kinds).toContain("suppress");
    expect(kinds).toContain("inject");
    expect(kinds).toContain("remap");
  });
});

// ─── mergeUpstreamProvenance ──────────────────────────────

describe("mergeUpstreamProvenance", () => {
  const baseResult: ArbitrationResult = {
    selected: null,
    truthSet: [],
    acceptableSet: [],
    recommended: [],
    eliminations: [],
    provenance: {
      applicability: { factDependencies: [], evaluatedConditions: [] },
      activation: [],
      transforms: [],
      encoding: [],
      legality: [],
      arbitration: [],
      eliminations: [],
      handoffs: [],
    },
  };

  it("returns unchanged result when no transforms applied", () => {
    const merged = mergeUpstreamProvenance(baseResult, []);

    expect(merged.provenance!.transforms).toHaveLength(0);
  });

  it("grafts TransformApplication entries into provenance.transforms", () => {
    const transforms = [{
      transformId: "t1",
      kind: "suppress" as const,
      targetId: "target:bid",
      sourceModuleId: "mod",
      reason: "test reason",
      affectedMeaningIds: ["target:bid"],
    }];

    const merged = mergeUpstreamProvenance(baseResult, transforms);

    expect(merged.provenance!.transforms).toHaveLength(1);
    expect(merged.provenance!.transforms[0]!.transformId).toBe("t1");
    expect(merged.provenance!.transforms[0]!.kind).toBe("suppress");
    expect(merged.provenance!.transforms[0]!.affectedCandidateIds).toEqual(["target:bid"]);
  });

  it("preserves existing provenance fields", () => {
    const resultWithProvenance: ArbitrationResult = {
      ...baseResult,
      provenance: {
        ...baseResult.provenance!,
        activation: [{ moduleId: "test", activated: true }],
      },
    };

    const merged = mergeUpstreamProvenance(resultWithProvenance, [{
      transformId: "t1",
      kind: "suppress" as const,
      targetId: "x",
      sourceModuleId: "mod",
      reason: "r",
      affectedMeaningIds: [],
    }]);

    expect(merged.provenance!.activation).toHaveLength(1);
    expect(merged.provenance!.transforms).toHaveLength(1);
  });

  it("handles result with no provenance", () => {
    const noProvResult: ArbitrationResult = {
      selected: null,
      truthSet: [],
      acceptableSet: [],
      recommended: [],
      eliminations: [],
    };

    const merged = mergeUpstreamProvenance(noProvResult, [{
      transformId: "t1",
      kind: "suppress" as const,
      targetId: "x",
      sourceModuleId: "mod",
      reason: "r",
      affectedMeaningIds: ["x"],
    }]);

    expect(merged.provenance!.transforms).toHaveLength(1);
  });

  it("threads surface diagnostics into provenance.surfaceDiagnostics", () => {
    const diagnostics: SurfaceCompositionDiagnostic[] = [
      { level: "info", message: "Suppressed surface \"target\" via transform \"t1\"" },
      { level: "warn", message: "Suppress transform \"t2\" targets \"missing\" but no matching surface found" },
    ];

    const merged = mergeUpstreamProvenance(baseResult, [], diagnostics);

    expect(merged.provenance!.surfaceDiagnostics).toHaveLength(2);
    expect(merged.provenance!.surfaceDiagnostics![0]!.level).toBe("info");
    expect(merged.provenance!.surfaceDiagnostics![1]!.level).toBe("warn");
  });

  it("defaults surfaceDiagnostics to empty when no diagnostics provided", () => {
    const merged = mergeUpstreamProvenance(baseResult, []);

    expect(merged.provenance!.surfaceDiagnostics).toEqual([]);
  });
});
