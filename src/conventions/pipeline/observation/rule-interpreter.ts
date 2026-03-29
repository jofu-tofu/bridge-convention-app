/**
 * Rule interpreter — collects matching claims from ConventionModules against an AuctionContext.
 *
 * For each module:
 * 1. Replay log to advance local FSM from initial through each CommittedStep
 * 2. Get current local phase and current kernel
 * 3. For each rule: check turn, local, kernel, route match conditions
 * 4. Collect matching surfaces (with negotiationDeltas)
 *
 * Phase 3 simplification: replays local FSMs once per collectMatchingClaims() call.
 * With N ≤ 20 steps and 4 modules, this is ~80 phase transition checks (negligible).
 */

import type { Seat } from "../../../engine/types";
import { partnerSeat } from "../../../engine/constants";
import type { BidMeaning } from "../evaluation/meaning";
import type { AuctionContext, CommittedStep, NegotiationState } from "../../core/committed-step";
import { INITIAL_NEGOTIATION } from "../../core/committed-step";
import type { ConventionModule } from "../../core/convention-module";
import { TurnRole } from "../../core/rule-module";
import type { ResolvedSurface, StateEntry } from "../../core/rule-module";
import { advanceLocalFsm } from "./local-fsm";
import { matchKernel } from "./negotiation-matcher";
import { matchRoute } from "./route-matcher";

/** Result for one module — resolved surfaces with their negotiation deltas. */
export interface ModuleSurfaceResult {
  readonly moduleId: string;
  readonly resolved: readonly ResolvedSurface[];
}

/** Convenience: flatten resolved surfaces to BidMeaning[] (discarding deltas). */
export function flattenSurfaces(results: readonly ModuleSurfaceResult[]): readonly BidMeaning[] {
  return results.flatMap(r => r.resolved.map(c => c.surface));
}

/**
 * Derive the turn role for the next bidder.
 *
 * Phase 3 (NT): opener is the first non-pass bidder in the log,
 * their partner is responder, everyone else is opponent.
 * If no bids in the log, the nextSeat is the opener.
 */
export function deriveTurnRole(
  nextSeat: Seat,
  log: readonly CommittedStep[],
): TurnRole {
  // Find the opener: first actor who communicated something meaningful
  // (non-empty publicActions indicates a resolved bid, not a pass/raw step)
  let openerSeat: Seat | null = null;
  for (const step of log) {
    if (step.publicActions.length > 0 && step.status !== "raw-only") {
      openerSeat = step.actor;
      break;
    }
  }

  if (openerSeat === null) {
    // No bids yet — next seat is the opener
    return TurnRole.Opener;
  }

  const responderSeat = partnerSeat(openerSeat);

  if (nextSeat === openerSeat) return TurnRole.Opener;
  if (nextSeat === responderSeat) return TurnRole.Responder;
  return TurnRole.Opponent;
}

/**
 * Collect all matching claims from convention modules against the current auction context.
 *
 * @param nextSeat - The seat that's about to bid (for turn matching)
 */
export function collectMatchingClaims(
  modules: readonly ConventionModule[],
  context: AuctionContext,
  nextSeat?: Seat,
): readonly ModuleSurfaceResult[] {
  const results: ModuleSurfaceResult[] = [];
  const currentKernel = getCurrentKernel(context);
  const turnRole = nextSeat !== undefined
    ? deriveTurnRole(nextSeat, context.log)
    : undefined;
  const openerSeat = findOpenerSeat(context.log);

  for (const mod of modules) {
    const currentPhase = replayLocalFsm(mod, context);
    const resolved = collectModuleSurfaces(
      mod, currentPhase, currentKernel, context, turnRole, openerSeat,
    );

    if (resolved.length > 0) {
      results.push({ moduleId: mod.moduleId, resolved });
    }
  }

  return results;
}

/**
 * Collect matching surfaces using pre-computed local phases (no replay).
 *
 * Used by buildObservationLogViaRules() to avoid O(N²×M) replay cost —
 * caller maintains a phase cache and advances it incrementally.
 */
export function collectMatchingClaimsWithPhases(
  modules: readonly ConventionModule[],
  context: AuctionContext,
  nextSeat: Seat | undefined,
  localPhases: ReadonlyMap<string, string>,
): readonly ModuleSurfaceResult[] {
  const results: ModuleSurfaceResult[] = [];
  const currentKernel = getCurrentKernel(context);
  const turnRole = nextSeat !== undefined
    ? deriveTurnRole(nextSeat, context.log)
    : undefined;
  const openerSeat = findOpenerSeat(context.log);

  for (const mod of modules) {
    const currentPhase = localPhases.get(mod.moduleId) ?? mod.local.initial;
    const resolved = collectModuleSurfaces(
      mod, currentPhase, currentKernel, context, turnRole, openerSeat,
    );

    if (resolved.length > 0) {
      results.push({ moduleId: mod.moduleId, resolved });
    }
  }

  return results;
}

// ── Internal helpers ─────────────────────────────────────────────────

/** Get the current kernel state from the context (last step's stateAfter, or INITIAL). */
function getCurrentKernel(context: AuctionContext): NegotiationState {
  if (context.log.length === 0) return INITIAL_NEGOTIATION;
  return context.log[context.log.length - 1]!.stateAfter;
}

/** Find the opener seat from the log (first actor with resolved observations). */
function findOpenerSeat(log: readonly CommittedStep[]): Seat | undefined {
  for (const step of log) {
    if (step.publicActions.length > 0 && step.status !== "raw-only") {
      return step.actor;
    }
  }
  return undefined;
}

/** Replay the log through a module's local FSM to get the current phase. */
function replayLocalFsm(
  mod: ConventionModule,
  context: AuctionContext,
): string {
  let phase = mod.local.initial;
  for (const step of context.log) {
    phase = advanceLocalFsm(phase, step, mod.local.transitions);
  }
  return phase;
}

/** Collect all resolved surfaces from matching state entries in a module. */
function collectModuleSurfaces(
  mod: ConventionModule,
  currentPhase: string,
  currentKernel: NegotiationState,
  context: AuctionContext,
  turnRole: TurnRole | undefined,
  openerSeat: Seat | undefined,
): ResolvedSurface[] {
  const resolved: ResolvedSurface[] = [];
  for (const entry of (mod.states ?? [])) {
    if (!stateEntryMatches(entry, currentPhase, currentKernel, context, turnRole, openerSeat)) continue;
    for (const surface of entry.surfaces) {
      resolved.push(entry.negotiationDelta ? { surface, negotiationDelta: entry.negotiationDelta } : { surface });
    }
  }
  return resolved;
}

/** Check if all of a state entry's activation conditions are satisfied. */
function stateEntryMatches(
  entry: StateEntry<string>,
  currentPhase: string,
  currentKernel: NegotiationState,
  context: AuctionContext,
  turnRole: TurnRole | undefined,
  openerSeat: Seat | undefined,
): boolean {
  if (entry.turn !== undefined && turnRole !== undefined && entry.turn !== turnRole) return false;
  if (Array.isArray(entry.phase)) {
    if (!(entry.phase as readonly string[]).includes(currentPhase)) return false;
  } else {
    if (entry.phase !== currentPhase) return false;
  }
  if (entry.kernel !== undefined && !matchKernel(entry.kernel, currentKernel)) return false;
  if (entry.route !== undefined && !matchRoute(entry.route, context.log, openerSeat)) return false;
  return true;
}

