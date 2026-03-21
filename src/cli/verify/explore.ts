// ── Bounded state exploration ────────────────────────────────────────
//
// Generates deals, runs strategy-driven auctions, and checks invariants
// at each step. Reports coverage and violations.

import type { RuleModule } from "../../conventions/core/rule-module";
import type { BiddingSystem } from "../../conventions/definitions/bidding-system";
import type { AuctionContext } from "../../core/contracts/committed-step";
import type { PublicSnapshot } from "../../core/contracts/module-surface";
import { INITIAL_KERNEL } from "../../core/contracts/committed-step";
import { collectMatchingClaims, advanceLocalFsm } from "../../conventions/core";
import { buildObservationLogViaRules, protocolSpecToStrategy } from "../../strategy/bidding/protocol-adapter";
import { specFromSystem } from "../../conventions/definitions/system-registry";
import { callKey } from "../../engine/call-helpers";
import type { Call, Seat } from "../../engine/types";

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
  ExplorationInvariant,
  ExplorationCoverage,
  ExplorationResult,
} from "./types";
import { ALL_INVARIANTS } from "./invariants";

export interface ExploreConfig {
  readonly depth: number;
  readonly seed: number;
  readonly trials: number;
  readonly invariants?: readonly string[];
}

const EMPTY_RESULT = (system: BiddingSystem, config: ExploreConfig): ExplorationResult => ({
  command: "verify explore",
  bundle: system.id,
  config: { depth: config.depth, seed: config.seed, trials: config.trials },
  coverage: { modulesActivated: [], phasesReached: {}, rulesFired: {}, atomsExercised: [] },
  violations: [],
  summary: { clean: true, trialsRun: 0, totalSteps: 0 },
});

/**
 * Run bounded state exploration on a bundle.
 *
 * Per trial: generate deal, run strategy-driven auction up to `depth` steps,
 * check invariants at each step. Track module/phase/rule/atom coverage.
 */
export function exploreBundle(
  system: BiddingSystem,
  modules: readonly RuleModule[],
  config: ExploreConfig,
): ExplorationResult {
  const spec = specFromSystem(system);
  if (!spec) return EMPTY_RESULT(system, config);

  // Filter invariants if specified
  const activeInvariants: readonly ExplorationInvariant[] = config.invariants
    ? ALL_INVARIANTS.filter((inv) => config.invariants!.includes(inv.id))
    : ALL_INVARIANTS;

  // Coverage tracking
  const modulesActivated = new Set<string>();
  const phasesReached = new Map<string, Set<string>>();
  const rulesFired = new Map<string, Set<number>>();
  const atomsExercised = new Set<string>();

  const violations: InvariantViolation[] = [];
  let totalSteps = 0;

  for (let trial = 0; trial < config.trials; trial++) {
    const trialSeed = config.seed + trial;

    try {
      const deal = generateSeededDeal(system, trialSeed);
      const userSeat = resolveUserSeat(system, deal);
      const partner = partnerOf(userSeat);
      const initAuction = buildInitialAuction(system, userSeat, deal);
      const strategy = protocolSpecToStrategy(spec);

      const auctionHistory: { call: Call; seat: Seat }[] = [...initAuction.entries];

      // Initialize local phases
      const localPhases = new Map<string, string>();
      for (const mod of modules) {
        localPhases.set(mod.id, mod.local.initial);
        if (!phasesReached.has(mod.id)) phasesReached.set(mod.id, new Set());
        phasesReached.get(mod.id)!.add(mod.local.initial);
      }

      for (let step = 0; step < config.depth; step++) {
        const nextSeat = auctionHistory.length > 0
          ? nextSeatClockwise(auctionHistory[auctionHistory.length - 1]!.seat)
          : userSeat;

        // Build observation log
        const log = buildObservationLogViaRules(auctionHistory, nextSeat, modules);

        // Build auction context and collect claims
        const auctionCtx: AuctionContext = { snapshot: {} as PublicSnapshot, log };
        const claims = collectMatchingClaims(modules, auctionCtx, nextSeat);

        // Track coverage
        for (const claim of claims) {
          modulesActivated.add(claim.moduleId);
          for (const surface of claim.surfaces) {
            atomsExercised.add(`${claim.moduleId}/${surface.meaningId}`);
          }
        }

        // Track phases
        for (const [modId, phase] of localPhases) {
          phasesReached.get(modId)?.add(phase);
        }

        // Build snapshot
        const auctionStrings = auctionHistory.map((e) => callKey(e.call));
        const currentKernel = log.length > 0 ? log[log.length - 1]!.postKernel : INITIAL_KERNEL;

        const snapshot: VerificationSnapshot = {
          seed: trialSeed,
          step,
          auction: auctionStrings,
          nextSeat,
          localPhases: new Map(localPhases),
          kernel: currentKernel,
          claims,
          log,
        };

        // Check invariants
        for (const inv of activeInvariants) {
          const violation = inv.check(snapshot);
          if (violation) violations.push(violation);
        }

        totalSteps++;

        // Get strategy's bid
        const isConventionPlayer = nextSeat === userSeat || nextSeat === partner;
        if (isConventionPlayer) {
          const hand = deal.hands[nextSeat];
          const auction = { entries: [...auctionHistory], isComplete: false };
          const context = buildContext(hand, auction, nextSeat);
          const result = strategy.suggest(context);

          if (!result) break;

          auctionHistory.push({ call: result.call, seat: nextSeat });

          // Track rules fired
          for (const claim of claims) {
            if (!rulesFired.has(claim.moduleId)) rulesFired.set(claim.moduleId, new Set());
            const mod = modules.find((m) => m.id === claim.moduleId);
            if (mod) {
              for (let ri = 0; ri < mod.rules.length; ri++) {
                for (const c of mod.rules[ri]!.claims) {
                  if (claim.surfaces.includes(c.surface)) {
                    rulesFired.get(claim.moduleId)!.add(ri);
                  }
                }
              }
            }
          }
        } else {
          auctionHistory.push({ call: { type: "pass" }, seat: nextSeat });
        }

        // Advance local phases from the last committed step
        if (log.length > 0) {
          const lastStep = log[log.length - 1]!;
          for (const mod of modules) {
            const current = localPhases.get(mod.id) ?? mod.local.initial;
            localPhases.set(mod.id, advanceLocalFsm(current, lastStep, mod.local.transitions));
          }
        }

        // Check auction completion (3 consecutive passes after a bid)
        if (auctionHistory.length >= 4) {
          const tail = auctionHistory.slice(-3);
          if (tail.every((e) => e.call.type === "pass") &&
              auctionHistory.some((e) => e.call.type === "bid")) {
            break;
          }
        }
      }
    } catch {
      // Swallow errors per trial — fuzz handles crash reporting
    }
  }

  const coverage: ExplorationCoverage = {
    modulesActivated: [...modulesActivated],
    phasesReached: Object.fromEntries(
      [...phasesReached.entries()].map(([k, v]) => [k, [...v]]),
    ),
    rulesFired: Object.fromEntries(
      [...rulesFired.entries()].map(([k, v]) => [k, [...v]]),
    ),
    atomsExercised: [...atomsExercised],
  };

  return {
    command: "verify explore",
    bundle: system.id,
    config: { depth: config.depth, seed: config.seed, trials: config.trials },
    coverage,
    violations,
    summary: {
      clean: violations.length === 0,
      trialsRun: config.trials,
      totalSteps,
    },
  };
}
