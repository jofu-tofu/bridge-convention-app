import { describe, it, expect } from "vitest";
import { getAllModules } from "../module-registry";
import type { ConventionModule } from "../../core/convention-module";
import { moduleSurfaces } from "../../core/convention-module";
import type { BidMeaning } from "../../pipeline/meaning";
import {
  PRIMITIVE_FACTS,
  BRIDGE_DERIVED_FACTS,
  SHARED_FACTS,
} from "../../core/shared-facts";

// ── Helpers ──────────────────────────────────────────────────────

const modules = getAllModules();
const moduleEntries: [string, ConventionModule][] = modules.map((m) => [
  m.moduleId,
  m,
]);

/** All shared/platform fact IDs (primitives + bridge-derived + shared). */
const sharedFactIds = new Set(
  [...PRIMITIVE_FACTS, ...BRIDGE_DERIVED_FACTS, ...SHARED_FACTS].map(
    (f) => f.id,
  ),
);

/** Collect all distinct surfaces from a module (deduped by meaningId). */
function allUniqueSurfaces(mod: ConventionModule): BidMeaning[] {
  // moduleSurfaces already deduplicates by meaningId
  return [...moduleSurfaces(mod)];
}

// ── 1. Structural contract ───────────────────────────────────────

describe.each(moduleEntries)("structural contract — %s", (_id, mod) => {
  it("moduleId is a non-empty string", () => {
    expect(typeof mod.moduleId).toBe("string");
    expect(mod.moduleId.length).toBeGreaterThan(0);
  });

  it("has states", () => {
    const hasStates = mod.states && mod.states.length > 0;
    expect(hasStates).toBe(true);
  });

  it("facts has definitions array and evaluators map", () => {
    expect(mod.facts).toBeDefined();
    expect(Array.isArray(mod.facts.definitions)).toBe(true);
    expect(mod.facts.evaluators).toBeInstanceOf(Map);
  });

  it("explanationEntries is a non-empty array", () => {
    expect(Array.isArray(mod.explanationEntries)).toBe(true);
    expect(mod.explanationEntries.length).toBeGreaterThan(0);
  });

});

// ── 2. Surface integrity ─────────────────────────────────────────

describe.each(moduleEntries)("surface integrity — %s", (_id, mod) => {
  const surfaces = allUniqueSurfaces(mod);

  it("every surface has required fields with correct types", () => {
    for (const s of surfaces) {
      expect(s.meaningId).toEqual(expect.any(String));
      expect(s.semanticClassId).toEqual(expect.any(String));
      expect(s.moduleId).toEqual(expect.any(String));
      expect(s.encoding).toBeDefined();
      expect(Array.isArray(s.clauses)).toBe(true);
      expect(s.ranking).toBeDefined();
      expect(s.teachingLabel).toEqual(expect.any(String));
    }
  });

  it("every surface.moduleId matches the owning module moduleId", () => {
    for (const s of surfaces) {
      expect(s.moduleId).toBe(mod.moduleId);
    }
  });

  it("no duplicate meaningIds within surfaces", () => {
    const ids = moduleSurfaces(mod).map((s) => s.meaningId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── 3. Fact integrity ────────────────────────────────────────────

describe.each(moduleEntries)("fact integrity — %s", (_id, mod) => {
  const defs = mod.facts.definitions;

  it("every fact definition has id, layer, world, valueType", () => {
    for (const d of defs) {
      expect(d.id).toEqual(expect.any(String));
      expect(d.layer).toEqual(expect.any(String));
      expect(d.world).toEqual(expect.any(String));
      expect(d.valueType).toEqual(expect.any(String));
    }
  });

  it("no duplicate fact definition IDs", () => {
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every evaluator key matches a definition ID or shared fact", () => {
    const localIds = new Set(defs.map((d) => d.id));
    for (const key of mod.facts.evaluators.keys()) {
      expect(localIds.has(key) || sharedFactIds.has(key)).toBe(true);
    }
  });
});

// ── 4. Explanation entry integrity ───────────────────────────────

describe.each(moduleEntries)("explanation integrity — %s", (_id, mod) => {
  it("every entry has explanationId, templateKey, preferredLevel", () => {
    for (const e of mod.explanationEntries) {
      expect(e.explanationId).toEqual(expect.any(String));
      expect(e.templateKey).toEqual(expect.any(String));
      expect(e.preferredLevel).toEqual(expect.any(String));
    }
  });

  it("no duplicate explanationIds within the module", () => {
    const ids = mod.explanationEntries.map((e) => e.explanationId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── 5. Cross-module invariants ───────────────────────────────────

describe("cross-module invariants", () => {
  it("no two modules share the same moduleId", () => {
    const ids = modules.map((m) => m.moduleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all 7 expected modules are present", () => {
    expect(modules).toHaveLength(7);
  });

  it("meaningIds are globally unique across modules", () => {
    const seen = new Map<string, string>();
    for (const mod of modules) {
      for (const s of allUniqueSurfaces(mod)) {
        const owner = seen.get(s.meaningId);
        if (owner !== undefined) {
          // Fail: two different modules own the same meaningId
          expect(owner).toBe(mod.moduleId);
        }
        seen.set(s.meaningId, mod.moduleId);
      }
    }
  });
});
