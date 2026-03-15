import type { BiddingContext } from "../../core/contracts";
import type { MeaningSurface } from "../../core/contracts/meaning-surface";
import type { CandidateTransform } from "../../core/contracts/meaning";
import type { MachineDebugSnapshot } from "../../core/contracts/recommendation";
import type { Auction, Seat } from "../../engine/types";
import type { ConversationMachine, MachineEvalResult } from "../../conventions/core/runtime/machine-types";
import type { EvaluationResult } from "../../conventions/core/runtime/types";
import { evaluateMachine } from "../../conventions/core/runtime/machine-evaluator";

// ─── Surface Selection ─────────────────────────────────────────

/** Machine evaluation cache — avoids redundant FSM evaluation at the same auction length. */
export interface MachineCache {
  result: MachineEvalResult | null;
  auctionLength: number;
}

export function getMachineResult(
  machine: ConversationMachine,
  auction: Auction,
  seat: Seat,
  cache: MachineCache,
): MachineEvalResult {
  if (cache.auctionLength === auction.entries.length && cache.result) {
    return cache.result;
  }
  cache.result = evaluateMachine(machine, auction, seat);
  cache.auctionLength = auction.entries.length;
  return cache.result;
}

/** Select surfaces and collect machine transforms for the current auction position. */
export function selectActiveSurfaces(
  moduleSurfaces: readonly { moduleId: string; surfaces: readonly MeaningSurface[] }[],
  allSurfaces: readonly MeaningSurface[],
  context: BiddingContext,
  options?: {
    conversationMachine?: ConversationMachine;
    surfaceRouter?: (auction: Auction, seat: Seat) => readonly MeaningSurface[];
  },
  machineCache?: MachineCache,
): { surfaces: readonly MeaningSurface[]; machineTransforms: readonly CandidateTransform[] } | null {
  if (options?.conversationMachine && machineCache) {
    const machineResult = getMachineResult(
      options.conversationMachine, context.auction, context.seat, machineCache,
    );
    const activeGroupIds = new Set(machineResult.activeSurfaceGroupIds);
    const surfaces = moduleSurfaces
      .filter((g) => activeGroupIds.has(g.moduleId))
      .flatMap((g) => g.surfaces);
    if (surfaces.length === 0) return null;
    return { surfaces, machineTransforms: machineResult.collectedTransforms };
  }

  if (options?.surfaceRouter) {
    const surfaces = options.surfaceRouter(context.auction, context.seat);
    if (surfaces.length === 0) return null;
    return { surfaces, machineTransforms: [] };
  }

  if (allSurfaces.length === 0) return null;
  return { surfaces: allSurfaces, machineTransforms: [] };
}

// ─── Evaluation Runtime Bridge ─────────────────────────────────

/**
 * Flatten DecisionSurfaceEntry[] from the evaluation runtime into MeaningSurface[]
 * for the existing meaning pipeline. Bridges the gap between the two-phase
 * evaluation runtime and the strategy pipeline's surface input format.
 */
export function buildSurfacesFromEvaluation(
  evalResult: EvaluationResult,
): MeaningSurface[] {
  return evalResult.decisionSurfaces.flatMap(entry => entry.surfaces);
}

// ─── Debug Helpers ─────────────────────────────────────────────

/** Convert a MachineEvalResult to a lightweight debug DTO. */
export function toMachineDebugSnapshot(mr: MachineEvalResult): MachineDebugSnapshot {
  return {
    currentStateId: mr.context.currentStateId,
    stateHistory: [...mr.context.stateHistory],
    transitionHistory: [...mr.context.transitionHistory],
    activeSurfaceGroupIds: [...mr.activeSurfaceGroupIds],
    registers: {
      forcingState: mr.context.registers.forcingState,
      obligation: mr.context.registers.obligation,
      agreedStrain: mr.context.registers.agreedStrain,
      competitionMode: mr.context.registers.competitionMode,
      captain: mr.context.registers.captain,
      systemCapabilities: mr.context.registers.systemCapabilities,
    },
    diagnostics: mr.diagnostics.map(d => ({ level: d.level, message: d.message, moduleId: d.moduleId })),
    handoffTraces: mr.handoffTraces.map(h => ({ fromModuleId: h.fromModuleId, toModuleId: h.toModuleId, reason: h.reason })),
    submachineStack: mr.context.submachineStack.map(f => ({ parentMachineId: f.parentMachineId, returnStateId: f.returnStateId })),
  };
}
