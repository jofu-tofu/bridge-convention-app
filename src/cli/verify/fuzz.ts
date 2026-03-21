// ── Property-based fuzz testing ──────────────────────────────────────
//
// Runs many random deals through the strategy, checking invariants
// and catching crashes. Seeds from mulberry32 for reproducibility.

import type { RuleModule } from "../../conventions/core/rule-module";
import type { ConventionBundle } from "../../conventions/core/bundle/bundle-types";
import type { AuctionContext } from "../../core/contracts/committed-step";
import type { PublicSnapshot } from "../../core/contracts/module-surface";
import { INITIAL_NEGOTIATION } from "../../core/contracts/committed-step";
import { collectMatchingClaims } from "../../conventions/core";
import { buildObservationLogViaRules, protocolSpecToStrategy } from "../../strategy/bidding/protocol-adapter";
import { specFromBundle } from "../../conventions/definitions/system-registry";
import { callKey } from "../../engine/call-helpers";
import { mulberry32 } from "../../core/util/seeded-rng";
import type { Seat } from "../../engine/types";
import { Vulnerability } from "../../engine/types";
import type { Call } from "../../engine/types";

import {
  generateSeededDeal,
  resolveUserSeat,
  buildInitialAuction,
  buildContext,
  nextSeatClockwise,
  partnerOf,
} from "../shared";

import type {
  VerificationSnapshot,
  InvariantViolation,
  FuzzEdgeCase,
  FuzzResult,
} from "./types";
import { ALL_INVARIANTS } from "./invariants";

export interface FuzzConfig {
  readonly trials: number;
  readonly seed: number;
  readonly vulnMixed?: boolean;
}

const VULN_CYCLE: Vulnerability[] = [
  Vulnerability.None,
  Vulnerability.NorthSouth,
  Vulnerability.EastWest,
  Vulnerability.Both,
];

/**
 * Property-based fuzz testing for a bundle.
 *
 * Per trial: pick vulnerability, generate deal, run full auction,
 * check invariants at each step, catch crashes.
 */
export function fuzzBundle(
  bundle: ConventionBundle,
  modules: readonly RuleModule[],
  config: FuzzConfig,
): FuzzResult {
  const spec = specFromBundle(bundle);
  if (!spec) {
    return {
      command: "verify fuzz",
      bundle: bundle.id,
      config: { trials: config.trials, seed: config.seed },
      crashes: [],
      violations: [],
      edgeCases: [],
      summary: { clean: true, trialsRun: 0, passRate: 1 },
    };
  }
  const rng = mulberry32(config.seed);

  const crashes: { seed: number; error: string }[] = [];
  const violations: InvariantViolation[] = [];
  const edgeCases: FuzzEdgeCase[] = [];
  let trialsRun = 0;

  for (let trial = 0; trial < config.trials; trial++) {
    const trialSeed = Math.floor(rng() * 0x7FFF_FFFF);
    const vuln = config.vulnMixed
      ? VULN_CYCLE[trial % VULN_CYCLE.length]!
      : Vulnerability.None;

    trialsRun++;

    try {
      const deal = generateSeededDeal(bundle, trialSeed, vuln);
      const userSeat = resolveUserSeat(bundle, deal);
      const partner = partnerOf(userSeat);
      const initAuction = buildInitialAuction(bundle, userSeat, deal);
      const strategy = protocolSpecToStrategy(spec);

      const auctionHistory: { call: Call; seat: Seat }[] = [...initAuction.entries];
      const maxBids = 30;
      let step = 0;

      for (let bid = 0; bid < maxBids; bid++) {
        const nextSeat = auctionHistory.length > 0
          ? nextSeatClockwise(auctionHistory[auctionHistory.length - 1]!.seat)
          : userSeat;

        const isConventionPlayer = nextSeat === userSeat || nextSeat === partner;

        // Build observation log and collect claims for invariant checking
        const log = buildObservationLogViaRules(auctionHistory, nextSeat, modules);
        const auctionCtx: AuctionContext = { snapshot: {} as PublicSnapshot, log };
        const claims = collectMatchingClaims(modules, auctionCtx, nextSeat);

        const currentKernel = log.length > 0 ? log[log.length - 1]!.stateAfter : INITIAL_NEGOTIATION;
        const auctionStrings = auctionHistory.map((e) => callKey(e.call));

        const snapshot: VerificationSnapshot = {
          seed: trialSeed,
          step,
          auction: auctionStrings,
          nextSeat,
          localPhases: new Map(modules.map((m) => [m.id, m.local.initial])),
          kernel: currentKernel,
          claims,
          log,
        };

        // Check invariants
        for (const inv of ALL_INVARIANTS) {
          const violation = inv.check(snapshot);
          if (violation) {
            violations.push(violation);
          }
        }

        // Get bid
        if (isConventionPlayer) {
          const hand = deal.hands[nextSeat];
          const auction = { entries: [...auctionHistory], isComplete: false };
          const context = buildContext(hand, auction, nextSeat, vuln);
          const result = strategy.suggest(context);

          if (!result) {
            edgeCases.push({
              seed: trialSeed,
              kind: "strategy-null",
              message: `Strategy returned null at step ${step} for ${nextSeat}`,
            });
            break;
          }

          auctionHistory.push({ call: result.call, seat: nextSeat });
        } else {
          // Opponent passes
          auctionHistory.push({ call: { type: "pass" } as Call, seat: nextSeat });
        }

        step++;

        // Check auction completion
        if (auctionHistory.length >= 4) {
          const tail = auctionHistory.slice(-3);
          if (tail.every((e) => e.call.type === "pass") &&
              auctionHistory.some((e) => e.call.type === "bid")) {
            break;
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      crashes.push({ seed: trialSeed, error: msg });
    }
  }

  const clean = crashes.length === 0 && violations.length === 0;
  const passRate = trialsRun > 0
    ? (trialsRun - crashes.length) / trialsRun
    : 1;

  return {
    command: "verify fuzz",
    bundle: bundle.id,
    config: { trials: config.trials, seed: config.seed },
    crashes,
    violations,
    edgeCases,
    summary: {
      clean,
      trialsRun,
      passRate,
    },
  };
}
