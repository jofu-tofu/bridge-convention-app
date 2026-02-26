import type { EnginePort } from "../engine/port";
import type { Deal, Contract, DDSolution } from "../engine/types";

const DDS_TIMEOUT_MS = 10_000;

export function createDDSStore(engine: EnginePort) {
  let ddsSolution = $state<DDSolution | null>(null);
  let ddsSolving = $state(false);
  let ddsError = $state<string | null>(null);

  // Monotonic generation counter for stale-result guard.
  // Not reactive ($state) — only read inside async continuations.
  let solveGeneration = 0;

  async function triggerSolve(deal: Deal, _contract: Contract) {
    if (ddsSolving) return;
    const gen = ++solveGeneration;
    ddsSolving = true;
    ddsError = null;
    ddsSolution = null;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("DDS analysis timed out")),
          DDS_TIMEOUT_MS,
        );
      });
      const result = await Promise.race([
        engine.solveDeal(deal),
        timeoutPromise,
      ]);
      // Guard against stale results
      if (solveGeneration === gen) {
        ddsSolution = result;
      }
    } catch (err: unknown) {
      if (solveGeneration === gen) {
        ddsError = err instanceof Error ? err.message : String(err);
      }
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (solveGeneration === gen) {
        ddsSolving = false;
      }
    }
  }

  function reset() {
    ddsSolution = null;
    ddsSolving = false;
    ddsError = null;
    solveGeneration++; // Invalidate any in-flight solve
  }

  return {
    get ddsSolution() {
      return ddsSolution;
    },
    get ddsSolving() {
      return ddsSolving;
    },
    get ddsError() {
      return ddsError;
    },
    triggerSolve,
    reset,
  };
}
