/**
 * Kernel extractor — maps MachineRegisters to the clean KernelState type.
 *
 * MachineRegisters uses stringly-typed values (enum strings, open strings).
 * KernelState is a closed, typed representation suitable for rule matching.
 */

import type { MachineRegisters } from "../../../core/contracts/module-surface";
import { ForcingState } from "../../../core/contracts/bidding";
import type { KernelState, KernelDelta } from "../../../core/contracts/committed-step";
import type { ObsStrain } from "../../../core/contracts/canonical-observation";

/**
 * Extract a clean KernelState from stringly-typed MachineRegisters.
 */
export function extractKernelState(registers: MachineRegisters): KernelState {
  return {
    fitAgreed: extractFitAgreed(registers.agreedStrain),
    forcing: extractForcing(registers.forcingState),
    captain: extractCaptain(registers.captain),
    competition: extractCompetition(registers.competitionMode),
  };
}

/**
 * Compute the delta between two kernel states. Returns only changed fields.
 */
export function computeKernelDelta(
  before: KernelState,
  after: KernelState,
): KernelDelta {
  const delta: Record<string, unknown> = {};

  if (after.forcing !== before.forcing) {
    delta.forcing = after.forcing;
  }

  if (after.captain !== before.captain) {
    delta.captain = after.captain;
  }

  if (!fitAgreedEqual(before.fitAgreed, after.fitAgreed)) {
    delta.fitAgreed = after.fitAgreed;
  }

  if (!competitionEqual(before.competition, after.competition)) {
    delta.competition = after.competition;
  }

  return delta as KernelDelta;
}

// ── Internal helpers ─────────────────────────────────────────────────

function extractForcing(
  forcingState: ForcingState,
): KernelState["forcing"] {
  switch (forcingState) {
    case ForcingState.GameForcing:
      return "game";
    case ForcingState.ForcingOneRound:
      return "one-round";
    // PassForcing → "one-round": pass-forcing is a one-round constraint
    // (partner must not pass), not a distinct kernel concept.
    case ForcingState.PassForcing:
      return "one-round";
    case ForcingState.Nonforcing:
    default:
      return "none";
  }
}

function extractFitAgreed(
  agreedStrain: MachineRegisters["agreedStrain"],
): KernelState["fitAgreed"] {
  if (agreedStrain.type === "none") return null;

  const strain: ObsStrain =
    agreedStrain.type === "notrump"
      ? "notrump"
      : (agreedStrain.suit as ObsStrain) ?? "notrump";

  const confidence =
    agreedStrain.confidence === "final" ? "final" : "tentative";

  return { strain, confidence };
}

function extractCaptain(captain: string): KernelState["captain"] {
  if (captain === "opener") return "opener";
  if (captain === "responder") return "responder";
  return "undecided";
}

function extractCompetition(
  competitionMode: string,
): KernelState["competition"] {
  switch (competitionMode) {
    case "Doubled":
      return "doubled";
    case "Redoubled":
      return "redoubled";
    case "Contested":
      // TODO(Phase 4): replace with actual overcall strain/level from CommittedStep
      return { kind: "overcalled", strain: "notrump", level: 0 };
    case "Uncontested":
      return "uncontested";
    default:
      return "uncontested";
  }
}

function fitAgreedEqual(
  a: KernelState["fitAgreed"],
  b: KernelState["fitAgreed"],
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.strain === b.strain && a.confidence === b.confidence;
}

function competitionEqual(
  a: KernelState["competition"],
  b: KernelState["competition"],
): boolean {
  if (typeof a === "string" && typeof b === "string") return a === b;
  if (typeof a === "string" || typeof b === "string") return false;
  return a.kind === b.kind && a.strain === b.strain && a.level === b.level;
}
