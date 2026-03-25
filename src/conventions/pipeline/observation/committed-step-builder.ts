/**
 * CommittedStep builder — constructs a CommittedStep from an adjudicated bid.
 *
 * Combines arbitration result, canonical observations (via normalizeIntent),
 * and kernel state (via extractKernelState) into a single observation record.
 */

import type { Seat, Call } from "../../../engine/types";
import type {
  NegotiationState,
  ClaimRef,
  CommittedStep,
} from "../../core/committed-step";
import type { PipelineResult } from "../pipeline-types";
import type { MachineRegisters } from "../../core/module-surface";
import type { BidAction } from "../bid-action";
import { extractKernelState, computeKernelDelta } from "./negotiation-extractor";
import { normalizeIntent } from "./normalize-intent";

/**
 * Build a CommittedStep from one adjudicated auction action.
 *
 * @param actor - The seat that made the call
 * @param call - The call made
 * @param pipelineResult - The pipeline result, or null for unresolved bids
 * @param prevKernel - Kernel state before this step
 * @param currentRegisters - Machine registers after this step's effects
 */
export function buildCommittedStep(
  actor: Seat,
  call: Call,
  pipelineResult: PipelineResult | null,
  prevKernel: NegotiationState,
  currentRegisters: MachineRegisters,
): CommittedStep {
  const resolvedClaim = extractClaimRef(pipelineResult);
  const publicActions = extractPublicObs(pipelineResult);
  const stateAfter = extractKernelState(currentRegisters);
  const negotiationDelta = computeKernelDelta(prevKernel, stateAfter);
  const status = deriveStatus(pipelineResult);

  return {
    actor,
    call,
    resolvedClaim,
    publicActions,
    negotiationDelta,
    stateAfter,
    status,
  };
}

// ── Internal helpers ─────────────────────────────────────────────────

function extractClaimRef(
  arb: PipelineResult | null,
): ClaimRef | null {
  if (!arb?.selected) return null;

  const { proposal } = arb.selected;
  return {
    moduleId: proposal.moduleId,
    meaningId: proposal.meaningId,
    semanticClassId: proposal.semanticClassId ?? "",
    sourceIntent: proposal.sourceIntent,
  };
}

function extractPublicObs(
  arb: PipelineResult | null,
): readonly BidAction[] {
  if (!arb?.selected) return [];

  const { sourceIntent } = arb.selected.proposal;
  return normalizeIntent(sourceIntent);
}

function deriveStatus(
  arb: PipelineResult | null,
): CommittedStep["status"] {
  if (!arb) return "off-system";
  if (arb.selected) return "resolved";
  if (arb.truthSet.length > 0) return "ambiguous";
  return "off-system";
}
