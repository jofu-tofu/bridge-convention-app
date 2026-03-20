// ── CLI selftest command ────────────────────────────────────────────

import {
  generateProtocolCoverageManifest,
} from "../../conventions/core";
import { listSystems } from "../../conventions/definitions/system-registry";
import { getConventionSpec } from "../../conventions/spec-registry";
import { createSpecStrategy } from "../../bootstrap/strategy-factory";
import { callsMatch } from "../../engine/call-helpers";

import type { Flags, ConventionSpec, BiddingSystem, Vulnerability } from "../shared";
import {
  callKey,
  optionalNumericArg,
  resolveSpec, resolveSystem, generateSeededDeal, resolveUserSeat,
  resolveAuction, buildContext, nextSeatClockwise,
} from "../shared";

export function runSelftest(flags: Flags, vuln: Vulnerability): void {
  const bundleId = flags["bundle"] as string | undefined;
  const all = flags["all"] === true;
  const seed = optionalNumericArg(flags, "seed") ?? 42;

  if (!bundleId && !all) {
    console.error("selftest requires --bundle=<id> or --all");
    process.exit(2);
  }

  const specs: { id: string; spec: ConventionSpec; system: BiddingSystem }[] = [];

  if (all) {
    for (const system of listSystems()) {
      if (system.internal) continue;
      const spec = getConventionSpec(system.id);
      if (spec) {
        specs.push({ id: system.id, spec, system });
      }
    }
  } else {
    const spec = resolveSpec(bundleId!);
    const system = resolveSystem(bundleId!);
    specs.push({ id: bundleId!, spec, system });
  }

  let totalPass = 0;
  let totalFail = 0;
  let totalSkip = 0;
  const results: {
    bundle: string;
    atom: string;
    status: "pass" | "fail" | "skip";
    targeted: boolean;
    activeSeat?: string;
    correctBid?: string;
    details?: string;
  }[] = [];

  for (const { id, spec, system } of specs) {
    const manifest = generateProtocolCoverageManifest(spec);
    const allAtoms = [...manifest.baseAtoms, ...manifest.protocolAtoms];
    const strategy = createSpecStrategy(spec);

    for (let i = 0; i < allAtoms.length; i++) {
      const atom = allAtoms[i]!;
      const atomSeed = seed + i;
      const atomLabel = `${atom.baseStateId}/${atom.surfaceId}/${atom.meaningId}`;

      try {
        // Generate deal for this atom
        const deal = generateSeededDeal(system, atomSeed, vuln);
        const userSeat = resolveUserSeat(system, deal);

        // Build targeted auction to reach the atom's state
        const { auction, targeted } = resolveAuction(system, spec, deal, atom.baseStateId, userSeat);

        // Determine active seat at the target state
        const activeSeat = auction.entries.length > 0
          ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
          : userSeat;
        const hand = deal.hands[activeSeat];

        // Build context from the active seat's perspective
        const context = buildContext(hand, auction, activeSeat, vuln);

        // Run strategy
        const result = strategy.suggest(context);

        if (!result) {
          totalSkip++;
          results.push({
            bundle: id,
            atom: atomLabel,
            status: "skip",
            targeted,
            activeSeat: activeSeat as string,
            details: "Strategy returned null (no recommendation)",
          });
          continue;
        }

        // Self-test: strategy bid should be deterministic
        const bidKey = callKey(result.call);
        const verifyResult = strategy.suggest(context);
        if (!verifyResult || !callsMatch(result.call, verifyResult.call)) {
          totalFail++;
          results.push({
            bundle: id,
            atom: atomLabel,
            status: "fail",
            targeted,
            activeSeat: activeSeat as string,
            correctBid: bidKey,
            details: "Strategy is non-deterministic",
          });
          continue;
        }

        totalPass++;
        results.push({
          bundle: id,
          atom: atomLabel,
          status: "pass",
          targeted,
          activeSeat: activeSeat as string,
          correctBid: bidKey,
        });
      } catch (err: unknown) {
        totalFail++;
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          bundle: id,
          atom: atomLabel,
          status: "fail",
          targeted: false,
          details: `Error: ${msg}`,
        });
      }
    }
  }

  // Output summary
  const output = {
    seed,
    totalAtoms: results.length,
    pass: totalPass,
    fail: totalFail,
    skip: totalSkip,
    results,
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(totalFail > 0 ? 1 : 0);
}
