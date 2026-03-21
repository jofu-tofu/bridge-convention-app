// ── CLI info commands: list, bundles, describe ──────────────────────

import {
  enumerateRuleAtoms,
  generateRuleCoverageManifest,
} from "../../conventions/core";
import { listSystems } from "../../conventions/definitions/system-registry";
import { createSpecStrategy } from "../../bootstrap/strategy-factory";

import type { Flags, Vulnerability } from "../shared";
import {
  requireArg,
  resolveSpec, resolveSystemWithRules,
  generateSeededDeal, resolveUserSeat,
  buildInitialAuction, buildContext, nextSeatClockwise,
} from "../shared";

// ── list ─────────────────────────────────────────────────────────

export function runList(flags: Flags): void {
  const bundleId = requireArg(flags, "bundle");
  const system = resolveSystemWithRules(bundleId);
  const ruleModules = system.ruleModules ?? [];
  const atoms = enumerateRuleAtoms(ruleModules);

  for (const atom of atoms) {
    const line = {
      atomId: `${atom.moduleId}/${atom.meaningId}`,
      moduleId: atom.moduleId,
      meaningId: atom.meaningId,
      meaningLabel: atom.meaningLabel,
      encoding: atom.encoding,
      turnGuard: atom.turnGuard ?? null,
      primaryPhaseGuard: atom.primaryPhaseGuard ?? null,
      activationPaths: atom.allActivationPaths.length,
    };
    console.log(JSON.stringify(line));
  }
}

// ── bundles ──────────────────────────────────────────────────────

export function runBundles(): void {
  const systems = listSystems().filter((s) => !s.internal);
  const result = systems.map((s) => {
    const ruleModules = s.ruleModules ?? [];
    const atomCount = ruleModules.length > 0
      ? enumerateRuleAtoms(ruleModules).length
      : 0;
    return {
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      category: s.category ?? null,
      atomCount,
      moduleIds: s.moduleIds,
    };
  });
  console.log(JSON.stringify(result, null, 2));
}

// ── describe ─────────────────────────────────────────────────────

export function runDescribe(flags: Flags, vuln: Vulnerability): void {
  const bundleId = requireArg(flags, "bundle");
  const spec = resolveSpec(bundleId);
  const system = resolveSystemWithRules(bundleId);
  const ruleModules = system.ruleModules ?? [];

  const manifest = generateRuleCoverageManifest(system.id, ruleModules);
  const allAtoms = manifest.atoms;

  // Group atoms by module
  const moduleAtomCounts = new Map<string, number>();
  for (const atom of allAtoms) {
    moduleAtomCounts.set(
      atom.moduleId,
      (moduleAtomCounts.get(atom.moduleId) ?? 0) + 1,
    );
  }

  // Compute strategy coverage via selftest at seed 42
  const strategy = createSpecStrategy(spec);
  let covered = 0;
  let skipped = 0;
  for (let i = 0; i < allAtoms.length; i++) {
    const atomSeed = 42 + i;
    try {
      const deal = generateSeededDeal(system, atomSeed, vuln);
      const userSeat = resolveUserSeat(system, deal);
      const auction = buildInitialAuction(system, userSeat, deal);
      const activeSeat = auction.entries.length > 0
        ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
        : userSeat;
      const hand = deal.hands[activeSeat];
      const context = buildContext(hand, auction, activeSeat, vuln);
      const result = strategy.suggest(context);
      if (result) covered++;
      else skipped++;
    } catch {
      skipped++;
    }
  }

  const modules = [...moduleAtomCounts.entries()].map(([moduleId, count]) => ({
    moduleId,
    atomCount: count,
  }));
  modules.sort((a, b) => a.moduleId.localeCompare(b.moduleId));

  console.log(JSON.stringify({
    id: system.id,
    name: system.name,
    description: system.description ?? null,
    category: system.category ?? null,
    totalAtoms: allAtoms.length,
    totalModules: manifest.totalModules,
    strategyCoverage: {
      covered,
      skipped,
      percent: allAtoms.length > 0
        ? Math.round((covered / allAtoms.length) * 100)
        : 0,
    },
    modules,
    atoms: allAtoms.map((a) => ({
      atomId: `${a.moduleId}/${a.meaningId}`,
      meaningLabel: a.meaningLabel,
      moduleId: a.moduleId,
      turnGuard: a.turnGuard ?? null,
      primaryPhaseGuard: a.primaryPhaseGuard ?? null,
    })),
  }, null, 2));
}
