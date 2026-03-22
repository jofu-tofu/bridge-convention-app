// ── CLI info commands: list, bundles, describe ──────────────────────

import {
  enumerateRuleAtoms,
  generateRuleCoverageManifest,
} from "../../conventions/core";
import { listBundleInputs, resolveBundle as resolveBundleFn } from "../../conventions/definitions/system-registry";
import { SAYC_SYSTEM_CONFIG } from "../../core/contracts/system-config";
import { AVAILABLE_BASE_SYSTEMS } from "../../core/contracts/system-config";
import { createSpecStrategy } from "../../bootstrap/strategy-factory";

import type { Flags, Vulnerability, BaseSystemId } from "../shared";
import {
  requireArg,
  resolveSpec, resolveBundleWithRules,
  generateSeededDeal, resolveUserSeat,
  buildInitialAuction, buildContext, nextSeatClockwise,
} from "../shared";

// ── list ─────────────────────────────────────────────────────────

export function runList(flags: Flags, baseSystem?: BaseSystemId): void {
  const bundleId = requireArg(flags, "bundle");
  const bundle = resolveBundleWithRules(bundleId, baseSystem);
  const modules = bundle.modules ?? [];
  const atoms = enumerateRuleAtoms(modules);

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
  const inputs = listBundleInputs().filter((b) => !b.internal);
  const result = inputs.map((b) => {
    const resolved = resolveBundleFn(b, SAYC_SYSTEM_CONFIG);
    const modules = resolved.modules ?? [];
    const atomCount = modules.length > 0
      ? enumerateRuleAtoms(modules).length
      : 0;
    return {
      id: b.id,
      name: b.name,
      description: b.description ?? null,
      category: b.category ?? null,
      atomCount,
      moduleIds: b.memberIds,
    };
  });
  console.log(JSON.stringify(result, null, 2));
}

// ── systems ─────────────────────────────────────────────────────

export function runSystems(): void {
  const result = AVAILABLE_BASE_SYSTEMS.map((s) => ({
    id: s.id,
    label: s.label,
    shortLabel: s.shortLabel,
  }));
  console.log(JSON.stringify(result, null, 2));
}

// ── describe ─────────────────────────────────────────────────────

export function runDescribe(flags: Flags, vuln: Vulnerability, baseSystem: BaseSystemId): void {
  const bundleId = requireArg(flags, "bundle");
  const spec = resolveSpec(bundleId, baseSystem);
  const bundle = resolveBundleWithRules(bundleId, baseSystem);
  const bundleModules = bundle.modules ?? [];

  const manifest = generateRuleCoverageManifest(bundle.id, bundleModules);
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
      const deal = generateSeededDeal(bundle, atomSeed, vuln);
      const userSeat = resolveUserSeat(bundle, deal);
      const auction = buildInitialAuction(bundle, userSeat, deal);
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
    id: bundle.id,
    name: bundle.name,
    description: bundle.description ?? null,
    category: bundle.category ?? null,
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
