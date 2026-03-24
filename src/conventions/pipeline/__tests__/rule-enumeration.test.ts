import { describe, it, expect } from "vitest";
import {
  enumerateRuleAtoms,
  generateRuleCoverageManifest,
} from "../rule-enumeration";
import type { ConventionModule } from "../../core/convention-module";
import type { BidMeaning } from "../meaning";
import { BidSuit } from "../../../engine/types";

// ── Real module imports for equivalence checks ──────────────────────
import { getModule } from "../../definitions/module-registry";

function makeSurface(id: string, level: number = 1, strain: BidSuit = BidSuit.Clubs): BidMeaning {
  return {
    meaningId: id,
    semanticClassId: `test:${id}`,
    teachingLabel: id,
    clauses: [],
    sourceIntent: { type: "Test", params: {} },
    encoding: { defaultCall: { type: "bid", level, strain } },
    ranking: {
      recommendationBand: "preferred",
      declarationOrder: 0,
    },
  } as unknown as BidMeaning;
}

// ── Synthetic tests ─────────────────────────────────────────────────

describe("enumerateRuleAtoms", () => {
  it("returns empty for no modules", () => {
    expect(enumerateRuleAtoms([])).toEqual([]);
  });

  it("returns empty for module with no state entries", () => {
    const mod: ConventionModule = {
      moduleId: "empty",
      description: "test module",
      purpose: "test",
      local: { initial: "idle", transitions: [] },
      states: [],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };
    expect(enumerateRuleAtoms([mod])).toEqual([]);
  });

  it("extracts atoms from a single module with surfaces", () => {
    const s1 = makeSurface("s1");
    const s2 = makeSurface("s2", 2, BidSuit.Hearts);
    const mod: ConventionModule = {
      moduleId: "test-mod",
      description: "test module",
      purpose: "test",
      local: { initial: "idle", transitions: [] },
      states: [
        { phase: "idle", turn: "responder", surfaces: [s1, s2] },
      ],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };

    const atoms = enumerateRuleAtoms([mod]);
    expect(atoms).toHaveLength(2);
    expect(atoms[0]!.moduleId).toBe("test-mod");
    expect(atoms[0]!.meaningId).toBe("s1");
    expect(atoms[0]!.encoding).toEqual({ type: "bid", level: 1, strain: BidSuit.Clubs });
    expect(atoms[0]!.primaryPhaseGuard).toBe("idle");
    expect(atoms[0]!.turnGuard).toBe("responder");
    expect(atoms[1]!.meaningId).toBe("s2");
  });

  it("deduplicates same meaningId across state entries in same module", () => {
    const surface = makeSurface("dup-surface");
    const mod: ConventionModule = {
      moduleId: "dedup-mod",
      description: "test module",
      purpose: "test",
      local: { initial: "idle", transitions: [] },
      states: [
        { phase: "phase-a", surfaces: [surface] },
        { phase: "phase-b", surfaces: [surface] },
      ],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };

    const atoms = enumerateRuleAtoms([mod]);
    expect(atoms).toHaveLength(1);
    expect(atoms[0]!.meaningId).toBe("dup-surface");
    expect(atoms[0]!.allActivationPaths).toHaveLength(2);
    expect(atoms[0]!.allActivationPaths[0]!.phaseGuards).toBe("phase-a");
    expect(atoms[0]!.allActivationPaths[1]!.phaseGuards).toBe("phase-b");
  });

  it("deduplicates identical guard combinations", () => {
    const surface = makeSurface("dup");
    const mod: ConventionModule = {
      moduleId: "mod",
      description: "test module",
      purpose: "test",
      local: { initial: "idle", transitions: [] },
      states: [
        { phase: "idle", surfaces: [surface] },
        { phase: "idle", surfaces: [surface] },
      ],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };

    const atoms = enumerateRuleAtoms([mod]);
    expect(atoms).toHaveLength(1);
    expect(atoms[0]!.allActivationPaths).toHaveLength(1);
  });

  it("preserves atom order: modules in array order, rules in array order", () => {
    const s1 = makeSurface("mod1-s1");
    const s2 = makeSurface("mod2-s1");
    const mod1: ConventionModule = {
      moduleId: "first",
      description: "test module",
      purpose: "test",
      local: { initial: "idle", transitions: [] },
      states: [{ phase: "idle", surfaces: [s1] }],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };
    const mod2: ConventionModule = {
      moduleId: "second",
      description: "test module",
      purpose: "test",
      local: { initial: "idle", transitions: [] },
      states: [{ phase: "idle", surfaces: [s2] }],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };

    const atoms = enumerateRuleAtoms([mod1, mod2]);
    expect(atoms).toHaveLength(2);
    expect(atoms[0]!.moduleId).toBe("first");
    expect(atoms[1]!.moduleId).toBe("second");
  });

  it("handles state entries with no surfaces gracefully", () => {
    const mod: ConventionModule = {
      moduleId: "no-surfaces",
      description: "test module",
      purpose: "test",
      local: { initial: "idle", transitions: [] },
      states: [{ phase: "idle", surfaces: [] }],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };
    expect(enumerateRuleAtoms([mod])).toEqual([]);
  });
});

describe("generateRuleCoverageManifest", () => {
  it("produces correct manifest structure", () => {
    const surface = makeSurface("test-atom");
    const mod: ConventionModule = {
      moduleId: "test-mod",
      description: "test module",
      purpose: "test",
      local: { initial: "idle", transitions: [] },
      states: [{ phase: "idle", surfaces: [surface] }],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };

    const manifest = generateRuleCoverageManifest("test-system", [mod]);
    expect(manifest.systemId).toBe("test-system");
    expect(manifest.totalModules).toBe(1);
    expect(manifest.totalAtoms).toBe(1);
    expect(manifest.atoms).toHaveLength(1);
    expect(manifest.atomsByModule.get("test-mod")).toHaveLength(1);
  });
});

// ── Real bundle equivalence checks (informational) ──────────────────

describe("real bundle atom counts", () => {
  const bundles = [
    { name: "nt-bundle", modules: [getModule("natural-nt")!, getModule("stayman")!, getModule("jacoby-transfers")!, getModule("smolen")!] },
    { name: "bergen-bundle", modules: [getModule("bergen")!] },
    { name: "dont-bundle", modules: [getModule("dont")!] },
    { name: "weak-twos-bundle", modules: [getModule("weak-twos")!] },
  ];

  for (const { name, modules } of bundles) {
    it(`${name}: produces non-zero atoms from rule modules`, () => {
      const atoms = enumerateRuleAtoms(modules);
      expect(atoms.length).toBeGreaterThan(0);
      // Every atom has required fields
      for (const atom of atoms) {
        expect(atom.moduleId).toBeTruthy();
        expect(atom.meaningId).toBeTruthy();
        expect(atom.meaningLabel).toBeTruthy();
        expect(atom.encoding).toBeTruthy();
        expect(atom.allActivationPaths.length).toBeGreaterThan(0);
      }
    });

    it(`${name}: no duplicate atom IDs (moduleId/meaningId)`, () => {
      const atoms = enumerateRuleAtoms(modules);
      const ids = atoms.map((a) => `${a.moduleId}/${a.meaningId}`);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  }

  it("logs atom counts for all bundles (informational)", () => {
    for (const { name, modules } of bundles) {
      const atoms = enumerateRuleAtoms(modules);
      const byModule = new Map<string, number>();
      for (const a of atoms) {
        byModule.set(a.moduleId, (byModule.get(a.moduleId) ?? 0) + 1);
      }
      const breakdown = [...byModule.entries()]
        .map(([mod, count]) => `${mod}=${count}`)
        .join(", ");
      console.log(`${name}: ${atoms.length} atoms (${breakdown})`);
    }
  });
});
