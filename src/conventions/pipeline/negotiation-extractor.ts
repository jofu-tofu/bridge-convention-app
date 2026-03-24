/**
 * Kernel extractor — maps MachineRegisters to the clean NegotiationState type.
 *
 * MachineRegisters uses stringly-typed values (enum strings, open strings).
 * NegotiationState is a closed, typed representation suitable for rule matching.
 */

import type { MachineRegisters } from "../core/module-surface";
import { ForcingState } from "../../strategy/bidding/bidding-types";
import type { NegotiationState, NegotiationDelta } from "../core/committed-step";
import type { BidSuitName } from "./bid-action";

/**
 * Extract a clean NegotiationState from stringly-typed MachineRegisters.
 */
export function extractKernelState(registers: MachineRegisters): NegotiationState {
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
  before: NegotiationState,
  after: NegotiationState,
): NegotiationDelta {
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

  return delta as NegotiationDelta;
}

// ── Internal helpers ─────────────────────────────────────────────────

function extractForcing(
  forcingState: ForcingState,
): NegotiationState["forcing"] {
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
): NegotiationState["fitAgreed"] {
  if (agreedStrain.type === "none") return null;

  const strain: BidSuitName =
    agreedStrain.type === "notrump"
      ? "notrump"
      : (agreedStrain.suit as BidSuitName) ?? "notrump";

  const confidence =
    agreedStrain.confidence === "final" ? "final" : "tentative";

  return { strain, confidence };
}

function extractCaptain(captain: string): NegotiationState["captain"] {
  if (captain === "opener") return "opener";
  if (captain === "responder") return "responder";
  return "undecided";
}

function extractCompetition(
  competitionMode: string,
): NegotiationState["competition"] {
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
  a: NegotiationState["fitAgreed"],
  b: NegotiationState["fitAgreed"],
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.strain === b.strain && a.confidence === b.confidence;
}

function competitionEqual(
  a: NegotiationState["competition"],
  b: NegotiationState["competition"],
): boolean {
  if (typeof a === "string" && typeof b === "string") return a === b;
  if (typeof a === "string" || typeof b === "string") return false;
  return a.kind === b.kind && a.strain === b.strain && a.level === b.level;
}
