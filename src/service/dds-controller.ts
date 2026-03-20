/**
 * DDS controller — extracted from dds.svelte.ts.
 *
 * Manages async DDS solve with timeout, stale-result guard, and generation counter.
 * No Svelte dependencies.
 */

import type { Deal, Contract, DDSolution } from "../engine/types";
import type { EnginePort } from "../engine/port";
import type { DDSolutionResult } from "./types";

const DDS_TIMEOUT_MS = 10_000;

export class DDSController {
  private solution: DDSolution | null = null;
  private solving = false;
  private error: string | null = null;
  private generation = 0;

  async solve(deal: Deal, _contract: Contract, engine: EnginePort): Promise<DDSolutionResult> {
    if (this.solving) {
      return { solution: null, error: "Solve already in progress" };
    }

    const gen = ++this.generation;
    this.solving = true;
    this.error = null;
    this.solution = null;

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
      if (this.generation === gen) {
        this.solution = result;
      }
    } catch (err: unknown) {
      if (this.generation === gen) {
        this.error = err instanceof Error ? err.message : String(err);
      }
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (this.generation === gen) {
        this.solving = false;
      }
    }

    return { solution: this.solution, error: this.error };
  }

  getResult(): DDSolutionResult {
    return { solution: this.solution, error: this.error };
  }

  isSolving(): boolean {
    return this.solving;
  }

  reset(): void {
    this.solution = null;
    this.solving = false;
    this.error = null;
    this.generation++;
  }
}
