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
import type { CommittedStep, NegotiationState } from "../../core/committed-step";
import { INITIAL_NEGOTIATION } from "../../core/committed-step";
import type { PipelineResult } from "../pipeline-types";
import type { MachineRegisters } from "../../core/module-surface";
import { buildCommittedStep } from "./committed-step-builder";

/** Input for one auction step. Provided by the strategy adapter. */
export interface ObservationLogStep {
  readonly actor: Seat;
  readonly call: Call;
  readonly registers: MachineRegisters;
  readonly pipelineResult: PipelineResult | null;
}

/**
 * Build a CommittedStep[] from per-step auction data.
 *
 * Threads kernel state through the loop: step N's prevKernel is
 * step N-1's stateAfter (or INITIAL_NEGOTIATION for step 0).
 */
export function buildObservationLog(
  steps: readonly ObservationLogStep[],
): readonly CommittedStep[] {
  const log: CommittedStep[] = [];
  let prevKernel: NegotiationState = INITIAL_NEGOTIATION;

  for (const step of steps) {
    const committed = buildCommittedStep(
      step.actor,
      step.call,
      step.pipelineResult,
      prevKernel,
      step.registers,
    );
    log.push(committed);
    prevKernel = committed.stateAfter;
  }

  return log;
}
