// ── CLI info commands: list, bundles, describe ──────────────────────

import {
  generateProtocolCoverageManifest,
  enumerateBaseTrackStates,
  getBaseModules,
} from "../../conventions/core";
import { listBundles } from "../../conventions/core";
import { getConventionSpec } from "../../conventions/spec-registry";
import { createSpecStrategy } from "../../bootstrap/strategy-factory";

import type { Flags, Vulnerability } from "../shared";
import {
  requireArg,
  resolveSpec, resolveBundle, generateSeededDeal, resolveUserSeat,
  resolveAuction, buildContext, nextSeatClockwise,
} from "../shared";

// ── list ─────────────────────────────────────────────────────────

export function runList(flags: Flags): void {
  const bundleId = requireArg(flags, "bundle");
  const spec = resolveSpec(bundleId);
  const manifest = generateProtocolCoverageManifest(spec);

  const allAtoms = [...manifest.baseAtoms, ...manifest.protocolAtoms];
  for (const atom of allAtoms) {
    const line = {
      baseStateId: atom.baseStateId,
      surfaceId: atom.surfaceId,
      meaningId: atom.meaningId,
      meaningLabel: atom.meaningLabel,
      involvesProtocol: atom.involvesProtocol,
      activeProtocols: atom.activeProtocols,
    };
    console.log(JSON.stringify(line));
  }
}

// ── bundles ──────────────────────────────────────────────────────

export function runBundles(): void {
  const bundles = listBundles().filter((b) => !b.internal);
  const result = bundles.map((b) => {
    const spec = getConventionSpec(b.id);
    let atomCount = 0;
    if (spec) {
      const manifest = generateProtocolCoverageManifest(spec);
      atomCount = manifest.baseAtoms.length + manifest.protocolAtoms.length;
    }
    return {
      id: b.id,
      name: b.name,
      description: b.description ?? null,
      category: b.category ?? null,
      atomCount,
      memberIds: b.memberIds,
    };
  });
  console.log(JSON.stringify(result, null, 2));
}

// ── describe ─────────────────────────────────────────────────────

export function runDescribe(flags: Flags, vuln: Vulnerability): void {
  const bundleId = requireArg(flags, "bundle");
  const spec = resolveSpec(bundleId);
  const bundle = resolveBundle(bundleId);

  const manifest = generateProtocolCoverageManifest(spec);
  const allAtoms = [...manifest.baseAtoms, ...manifest.protocolAtoms];

  // Compute depth info
  const stateDepths = new Map<string, number>();
  for (const track of getBaseModules(spec)) {
    const paths = enumerateBaseTrackStates(track);
    for (const [stateId, path] of paths) {
      stateDepths.set(stateId, Math.max(0, path.transitions.length - 1));
    }
  }
  const maxDepth = stateDepths.size > 0
    ? Math.max(...stateDepths.values())
    : 0;

  // Group atoms by state
  const stateAtomCounts = new Map<string, number>();
  for (const atom of allAtoms) {
    stateAtomCounts.set(
      atom.baseStateId,
      (stateAtomCounts.get(atom.baseStateId) ?? 0) + 1,
    );
  }

  // Compute strategy coverage via selftest at seed 42
  const strategy = createSpecStrategy(spec);
  let covered = 0;
  let skipped = 0;
  for (let i = 0; i < allAtoms.length; i++) {
    const atom = allAtoms[i]!;
    const atomSeed = 42 + i;
    try {
      const deal = generateSeededDeal(bundle, atomSeed, vuln);
      const userSeat = resolveUserSeat(bundle, deal);
      const { auction } = resolveAuction(bundle, spec, deal, atom.baseStateId, userSeat);
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

  const states = [...stateAtomCounts.entries()].map(([stateId, count]) => ({
    stateId,
    depth: stateDepths.get(stateId) ?? 0,
    atomCount: count,
  }));
  states.sort((a, b) => a.depth - b.depth || a.stateId.localeCompare(b.stateId));

  console.log(JSON.stringify({
    id: bundle.id,
    name: bundle.name,
    description: bundle.description ?? null,
    category: bundle.category ?? null,
    totalAtoms: allAtoms.length,
    maxDepth,
    strategyCoverage: {
      covered,
      skipped,
      percent: allAtoms.length > 0
        ? Math.round((covered / allAtoms.length) * 100)
        : 0,
    },
    states,
    atoms: allAtoms.map((a) => ({
      atomId: `${a.baseStateId}/${a.surfaceId}/${a.meaningId}`,
      meaningLabel: a.meaningLabel,
      depth: stateDepths.get(a.baseStateId) ?? 0,
    })),
  }, null, 2));
}
