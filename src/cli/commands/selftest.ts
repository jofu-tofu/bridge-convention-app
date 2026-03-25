// ── CLI selftest command ────────────────────────────────────────────

import { enumerateRuleAtoms, listBundleInputs, resolveBundle } from "../../conventions";
import type { RuleAtom } from "../../conventions";
import { SAYC_SYSTEM_CONFIG } from "../../conventions/definitions/system-config";
import { createSpecStrategy } from "../../session/strategy-factory";
import { callsMatch } from "../../engine/call-helpers";

import type { Flags, ConventionSpec, ConventionBundle, Vulnerability, Auction, Call, Seat, Deal, BaseSystemId } from "../shared";
import {
  callKey,
  optionalNumericArg,
  resolveSpec, resolveBundleWithRules,
  generateSeededDeal, resolveUserSeat,
  buildInitialAuction, buildContext, nextSeatClockwise, partnerOf,
} from "../shared";

/**
 * Strategy-driven forward auction construction.
 *
 * Starts from buildInitialAuction(), then runs the strategy in a loop
 * to extend the auction until the strategy produces the atom's expected
 * encoding or hits a safety limit. Opponents always pass.
 */
function buildForwardAuction(
  bundle: ConventionBundle,
  spec: ConventionSpec,
  deal: Deal,
  userSeat: Seat,
  atom: RuleAtom,
  vuln: Vulnerability,
): { auction: Auction; reached: boolean } {
  const strategy = createSpecStrategy(spec);
  const partner = partnerOf(userSeat);
  const initAuction = buildInitialAuction(bundle, userSeat, deal);
  const entries: { seat: Seat; call: Call }[] = [...initAuction.entries];
  const maxBids = 20;

  for (let iter = 0; iter < maxBids; iter++) {
    const activeSeat = entries.length > 0
      ? nextSeatClockwise(entries[entries.length - 1]!.seat)
      : userSeat;

    // Opponents always pass
    if (activeSeat !== userSeat && activeSeat !== partner) {
      entries.push({ seat: activeSeat, call: { type: "pass" } });
      // Check 3 consecutive passes after a bid → auction complete
      if (entries.length >= 4) {
        const tail = entries.slice(-3);
        if (tail.every((e) => e.call.type === "pass") && entries.some((e) => e.call.type === "bid")) {
          return { auction: { entries, isComplete: true }, reached: false };
        }
      }
      continue;
    }

    // Convention player's turn
    const hand = deal.hands[activeSeat];
    const auction: Auction = { entries: [...entries], isComplete: false };
    const context = buildContext(hand, auction, activeSeat, vuln);
    const result = strategy.suggest(context);

    if (!result) {
      return { auction: { entries, isComplete: false }, reached: false };
    }

    // Check if this bid matches the atom's encoding
    if (callsMatch(result.call, atom.encoding)) {
      return { auction: { entries, isComplete: false }, reached: true };
    }

    entries.push({ seat: activeSeat, call: result.call });
  }

  return { auction: { entries, isComplete: false }, reached: false };
}

export function runSelftest(flags: Flags, vuln: Vulnerability, baseSystem: BaseSystemId): void {
  const bundleId = flags["bundle"] as string | undefined;
  const all = flags["all"] === true;
  const seed = optionalNumericArg(flags, "seed") ?? 42;

  if (!bundleId && !all) {
    console.error("selftest requires --bundle=<id> or --all");
    process.exit(2);
  }

  const specs: { id: string; spec: ConventionSpec; bundle: ConventionBundle }[] = [];

  if (all) {
    for (const bundle of listBundleInputs().map(i => resolveBundle(i, SAYC_SYSTEM_CONFIG))) {
      if (bundle.internal) continue;
      if (!bundle.modules || bundle.modules.length === 0) continue;
      const spec = resolveSpec(bundle.id, baseSystem);
      specs.push({ id: bundle.id, spec, bundle });
    }
  } else {
    const spec = resolveSpec(bundleId!, baseSystem);
    const bundle = resolveBundleWithRules(bundleId!, baseSystem);
    specs.push({ id: bundleId!, spec, bundle });
  }

  let totalPass = 0;
  let totalFail = 0;
  let totalSkip = 0;
  const results: {
    bundle: string;
    atom: string;
    status: "pass" | "fail" | "skip";
    activeSeat?: string;
    correctBid?: string;
    details?: string;
  }[] = [];

  for (const { id, spec, bundle } of specs) {
    const modules = bundle.modules ?? [];
    const allAtoms = enumerateRuleAtoms(modules);
    const strategy = createSpecStrategy(spec);

    for (let i = 0; i < allAtoms.length; i++) {
      const atom = allAtoms[i]!;
      const atomSeed = seed + i;
      const atomLabel = `${atom.moduleId}/${atom.meaningId}`;

      try {
        // Generate deal for this atom
        const deal = generateSeededDeal(bundle, atomSeed, vuln);
        const userSeat = resolveUserSeat(bundle, deal);

        // Build auction via strategy-driven forward approach
        const { auction, reached } = buildForwardAuction(
          bundle, spec, deal, userSeat, atom, vuln,
        );

        if (!reached) {
          // Strategy didn't reach the atom's encoding — try at initial auction
          const initAuction = buildInitialAuction(bundle, userSeat, deal);
          const activeSeat = initAuction.entries.length > 0
            ? nextSeatClockwise(initAuction.entries[initAuction.entries.length - 1]!.seat)
            : userSeat;
          const hand = deal.hands[activeSeat];
          const context = buildContext(hand, initAuction, activeSeat, vuln);
          const result = strategy.suggest(context);

          if (!result) {
            totalSkip++;
            results.push({
              bundle: id,
              atom: atomLabel,
              status: "skip",
              activeSeat: activeSeat as string,
              details: "Strategy returned null (no recommendation)",
            });
            continue;
          }

          // Verify determinism
          const bidKey = callKey(result.call);
          const verifyResult = strategy.suggest(context);
          if (!verifyResult || !callsMatch(result.call, verifyResult.call)) {
            totalFail++;
            results.push({
              bundle: id,
              atom: atomLabel,
              status: "fail",
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
            activeSeat: activeSeat as string,
            correctBid: bidKey,
          });
          continue;
        }

        // Strategy reached the atom — verify at the auction position
        const activeSeat = auction.entries.length > 0
          ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
          : userSeat;
        const hand = deal.hands[activeSeat];
        const context = buildContext(hand, auction, activeSeat, vuln);
        const result = strategy.suggest(context);

        if (!result) {
          totalSkip++;
          results.push({
            bundle: id,
            atom: atomLabel,
            status: "skip",
            activeSeat: activeSeat as string,
            details: "Strategy returned null at target position",
          });
          continue;
        }

        // Assert bid matches atom encoding
        const bidKey = callKey(result.call);
        const expectedKey = callKey(atom.encoding);
        if (bidKey !== expectedKey) {
          totalFail++;
          results.push({
            bundle: id,
            atom: atomLabel,
            status: "fail",
            activeSeat: activeSeat as string,
            correctBid: expectedKey,
            details: `Expected ${expectedKey} but got ${bidKey}`,
          });
          continue;
        }

        // Self-test: verify determinism
        const verifyResult = strategy.suggest(context);
        if (!verifyResult || !callsMatch(result.call, verifyResult.call)) {
          totalFail++;
          results.push({
            bundle: id,
            atom: atomLabel,
            status: "fail",
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
