/**
 * DDS solver sub-module.
 *
 * Owns the reactive DDS state (solution, solving flag, error) and the
 * async solve trigger. Created via `createDDSSolver()` and called from
 * the game store coordinator.
 */

import type { DDSolution } from "../service";
import type { DevServicePort, DrillHandle } from "../service";

// ── Internal state shape ────────────────────────────────────────────

interface DDSState {
  solution: DDSolution | null;
  solving: boolean;
  error: string | null;
}

function freshDDSState(): DDSState {
  return { solution: null, solving: false, error: null };
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

// ── Dependency contract ─────────────────────────────────────────────

export interface DDSSolverDeps {
  getActiveHandle: () => DrillHandle | null;
  getActiveService: () => DevServicePort;
}

// ── Factory ─────────────────────────────────────────────────────────

export function createDDSSolver(deps: DDSSolverDeps) {
  let dds = $state<DDSState>(freshDDSState());

  async function triggerSolve(): Promise<void> {
    const handle = deps.getActiveHandle();
    if (!handle || dds.solving) return;

    dds.solving = true;
    dds.error = null;
    dds.solution = null;

    try {
      const result = await deps.getActiveService().getDDSSolution(handle);
      if (deps.getActiveHandle() !== handle) return; // cancelled
      dds.solution = result.solution;
      if (result.error) dds.error = result.error;
    } catch (err: unknown) {
      if (deps.getActiveHandle() !== handle) return;
      dds.error = describeError(err);
    } finally {
      if (deps.getActiveHandle() === handle) {
        dds.solving = false;
      }
    }
  }

  function reset(): void {
    dds = freshDDSState();
  }

  return {
    get solution() { return dds.solution; },
    get solving() { return dds.solving; },
    get error() { return dds.error; },
    triggerSolve,
    reset,
  };
}

export type DDSSolverModule = ReturnType<typeof createDDSSolver>;
