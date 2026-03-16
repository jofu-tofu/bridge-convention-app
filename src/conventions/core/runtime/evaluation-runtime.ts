import type { Auction, Seat } from "../../../engine/types";
import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { RuntimeModule, EvaluationResult } from "./types";
import type { ConversationMachine } from "./machine-types";
import { evaluateMachine } from "./machine-evaluator";
import { buildSnapshotFromAuction } from "./public-snapshot-builder";
import { emitDecisionSurfaces } from "./decision-surface-emitter";

/**
 * Two-phase evaluation: build public snapshot, then emit decision surfaces.
 *
 * When `machine` is provided, Phase 1 uses the FSM to determine register values
 * and active surface group IDs. Otherwise, uses stub defaults.
 */
export function evaluate(
  modules: readonly RuntimeModule[],
  auction: Auction,
  seat: Seat,
  activeModuleIds: readonly string[],
  options?: {
    machine?: ConversationMachine;
    surfaceRouter?: (auction: Auction, seat: Seat) => readonly MeaningSurface[];
  },
): EvaluationResult {
  // Phase 1: Build public snapshot
  const machineResult = options?.machine
    ? evaluateMachine(options.machine, auction, seat)
    : undefined;

  const publicSnapshot = buildSnapshotFromAuction(
    auction,
    seat,
    activeModuleIds,
    {
      machineRegisters: machineResult?.context.registers,
      surfaceRouter: options?.surfaceRouter,
    },
  );

  // Phase 2: Emit decision surfaces
  // When machine provides activeSurfaceGroupIds, filter modules by those groups
  const effectiveModules = machineResult
    ? filterModulesByMachineGroups(modules, machineResult.activeSurfaceGroupIds)
    : modules;

  const { entries, diagnostics: emitDiags } = emitDecisionSurfaces(
    effectiveModules,
    publicSnapshot,
    auction,
    seat,
  );

  const diagnostics = machineResult
    ? [...machineResult.diagnostics, ...emitDiags]
    : emitDiags;

  return {
    publicSnapshot,
    decisionSurfaces: entries,
    diagnostics,
    collectedTransforms: machineResult?.collectedTransforms,
  };
}

/** Filter modules to only those whose id is in the machine's activeSurfaceGroupIds. */
function filterModulesByMachineGroups(
  modules: readonly RuntimeModule[],
  activeSurfaceGroupIds: readonly string[],
): readonly RuntimeModule[] {
  const activeSet = new Set(activeSurfaceGroupIds);
  return modules.filter((m) => activeSet.has(m.id));
}
