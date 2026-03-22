import { describe, it, expect } from "vitest";
import {
  enumerateRuleAtoms,
  generateRuleCoverageManifest,
} from "../rule-enumeration";
import type { RuleModule } from "../../rule-module";
import type { BidMeaning } from "../../../../core/contracts/meaning";
import { BidSuit, Seat } from "../../../../engine/types";

// ── Real bundle imports for equivalence checks ──────────────────────
import { naturalNtRules } from "../../../definitions/modules/natural-nt-rules";
import { staymanRules } from "../../../definitions/modules/stayman-rules";
import { jacobyTransfersRules } from "../../../definitions/modules/jacoby-transfers-rules";
import { smolenRules } from "../../../definitions/modules/smolen-rules";
import { bergenRules } from "../../../definitions/modules/bergen/bergen-rules";
import { dontRules } from "../../../definitions/modules/dont/dont-rules";
import { weakTwosRules } from "../../../definitions/modules/weak-twos/weak-twos-rules";

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
      intraModuleOrder: 0,
    },
  } as unknown as BidMeaning;
}

// ── Synthetic tests ─────────────────────────────────────────────────

describe("enumerateRuleAtoms", () => {
  it("returns empty for no modules", () => {
    expect(enumerateRuleAtoms([])).toEqual([]);
  });

  it("returns empty for module with no rules", () => {
    const mod: RuleModule = {
      id: "empty",
      local: { initial: "idle", transitions: [] },
      rules: [],
      facts: { definitions: [], evaluators: new Map() },
    };
    expect(enumerateRuleAtoms([mod])).toEqual([]);
  });

  it("extracts atoms from a single module with claims", () => {
    const s1 = makeSurface("s1");
    const s2 = makeSurface("s2", 2, BidSuit.Hearts);
    const mod: RuleModule = {
      id: "test-mod",
      local: { initial: "idle", transitions: [] },
      rules: [
        {
          match: { local: "idle", turn: "responder" },
          claims: [{ surface: s1 }, { surface: s2 }],
        },
      ],
      facts: { definitions: [], evaluators: new Map() },
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

  it("deduplicates same meaningId across rules in same module", () => {
    const surface = makeSurface("dup-surface");
    const mod: RuleModule = {
      id: "dedup-mod",
      local: { initial: "idle", transitions: [] },
      rules: [
        { match: { local: "phase-a" }, claims: [{ surface }] },
        { match: { local: "phase-b" }, claims: [{ surface }] },
      ],
      facts: { definitions: [], evaluators: new Map() },
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
    const mod: RuleModule = {
      id: "mod",
      local: { initial: "idle", transitions: [] },
      rules: [
        { match: { local: "idle" }, claims: [{ surface }] },
        { match: { local: "idle" }, claims: [{ surface }] },
      ],
      facts: { definitions: [], evaluators: new Map() },
    };

    const atoms = enumerateRuleAtoms([mod]);
    expect(atoms).toHaveLength(1);
    expect(atoms[0]!.allActivationPaths).toHaveLength(1);
  });

  it("preserves atom order: modules in array order, rules in array order", () => {
    const s1 = makeSurface("mod1-s1");
    const s2 = makeSurface("mod2-s1");
    const mod1: RuleModule = {
      id: "first",
      local: { initial: "idle", transitions: [] },
      rules: [{ match: {}, claims: [{ surface: s1 }] }],
      facts: { definitions: [], evaluators: new Map() },
    };
    const mod2: RuleModule = {
      id: "second",
      local: { initial: "idle", transitions: [] },
      rules: [{ match: {}, claims: [{ surface: s2 }] }],
      facts: { definitions: [], evaluators: new Map() },
    };

    const atoms = enumerateRuleAtoms([mod1, mod2]);
    expect(atoms).toHaveLength(2);
    expect(atoms[0]!.moduleId).toBe("first");
    expect(atoms[1]!.moduleId).toBe("second");
  });

  it("handles rules with no claims gracefully", () => {
    const mod: RuleModule = {
      id: "no-claims",
      local: { initial: "idle", transitions: [] },
      rules: [{ match: { local: "idle" }, claims: [] }],
      facts: { definitions: [], evaluators: new Map() },
    };
    expect(enumerateRuleAtoms([mod])).toEqual([]);
  });
});

describe("generateRuleCoverageManifest", () => {
  it("produces correct manifest structure", () => {
    const surface = makeSurface("test-atom");
    const mod: RuleModule = {
      id: "test-mod",
      local: { initial: "idle", transitions: [] },
      rules: [{ match: { local: "idle" }, claims: [{ surface }] }],
      facts: { definitions: [], evaluators: new Map() },
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
    { name: "nt-bundle", modules: [naturalNtRules, staymanRules, jacobyTransfersRules, smolenRules] },
    { name: "bergen-bundle", modules: [bergenRules] },
    { name: "dont-bundle", modules: [dontRules] },
    { name: "weak-twos-bundle", modules: [weakTwosRules] },
  ] as const;

  for (const { name, modules } of bundles) {
    it(`${name}: produces non-zero atoms from rule modules`, () => {
      const atoms = enumerateRuleAtoms(modules as unknown as RuleModule[]);
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
      const atoms = enumerateRuleAtoms(modules as unknown as RuleModule[]);
      const ids = atoms.map((a) => `${a.moduleId}/${a.meaningId}`);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  }

  it("logs atom counts for all bundles (informational)", () => {
    for (const { name, modules } of bundles) {
      const atoms = enumerateRuleAtoms(modules as unknown as RuleModule[]);
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
