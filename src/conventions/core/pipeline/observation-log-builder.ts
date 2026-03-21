/**
 * Observation log builder — constructs a CommittedStep[] from per-step data.
 *
 * Single-pass O(n): iterates through steps once, threading kernel state.
 * The caller (strategy adapter) provides per-step registers and arbitration
 * results captured during protocol replay.
 *
 * **Temporal ordering:** The log contains observations for all PAST bids.
 * The current bid being evaluated is NOT in the log — its CommittedStep
 * is appended AFTER arbitration resolves it.
 */

import type { Seat, Call } from "../../../engine/types";
import type { CommittedStep, KernelState } from "../../../core/contracts/committed-step";
import { INITIAL_KERNEL } from "../../../core/contracts/committed-step";
import type { ArbitrationResult, MachineRegisters } from "../../../core/contracts/module-surface";
import { buildCommittedStep } from "./committed-step-builder";

/** Input for one auction step. Provided by the strategy adapter. */
export interface ObservationLogStep {
  readonly actor: Seat;
  readonly call: Call;
  readonly registers: MachineRegisters;
  readonly arbitration: ArbitrationResult | null;
}

/**
 * Build a CommittedStep[] from per-step auction data.
 *
 * Threads kernel state through the loop: step N's prevKernel is
 * step N-1's postKernel (or INITIAL_KERNEL for step 0).
 */
export function buildObservationLog(
  steps: readonly ObservationLogStep[],
): readonly CommittedStep[] {
  const log: CommittedStep[] = [];
  let prevKernel: KernelState = INITIAL_KERNEL;

  for (const step of steps) {
    const committed = buildCommittedStep(
      step.actor,
      step.call,
      step.arbitration,
      prevKernel,
      step.registers,
    );
    log.push(committed);
    prevKernel = committed.postKernel;
  }

  return log;
}
