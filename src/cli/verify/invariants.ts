// ── Invariant definitions for the verification CLI framework ────────
//
// Each invariant checks a VerificationSnapshot and returns an
// InvariantViolation if the check fails, or null if it passes.

import type {
  VerificationSnapshot,
  InvariantViolation,
  ExplorationInvariant,
} from "./types";
import { callKey } from "../../engine/call-helpers";
import { deriveTurnRole } from "../../conventions";
import { ConfidenceLevel } from "../../conventions/core/committed-step";

// ── Helpers ─────────────────────────────────────────────────────────

function buildViolation(
  invariant: string,
  snapshot: VerificationSnapshot,
  message: string,
): InvariantViolation {
  return {
    invariant,
    seed: snapshot.seed,
    step: snapshot.step,
    message,
    context: {
      auction: snapshot.auction,
      activeSeat: snapshot.nextSeat,
      localPhases: Object.fromEntries(snapshot.localPhases),
      kernel: snapshot.kernel,
    },
  };
}

// ── 1. Arbitration Totality ─────────────────────────────────────────

/**
 * At a convention-player turn (opener or responder), at least one claim
 * must match with non-empty surfaces. Opponents are not expected to
 * match convention claims.
 */
export function checkArbitrationTotality(
  snapshot: VerificationSnapshot,
): InvariantViolation | null {
  const role = deriveTurnRole(snapshot.nextSeat, snapshot.log);
  if (role === "opponent") return null;

  const hasMatchingSurfaces = snapshot.resolved.some(
    (claim) => claim.resolved.length > 0,
  );
  if (hasMatchingSurfaces) return null;

  return buildViolation(
    "arbitration-totality",
    snapshot,
    `No matching claims at ${role} turn (seat ${snapshot.nextSeat}, step ${snapshot.step})`,
  );
}

// ── 2. Kernel Consistency ───────────────────────────────────────────

const VALID_FORCING = new Set(["none", "one-round", "game"]);
const VALID_CAPTAIN = new Set(["opener", "responder", "undecided"]);
const VALID_COMPETITION_STRINGS = new Set([
  "uncontested",
  "doubled",
  "redoubled",
]);
const VALID_FIT_CONFIDENCE = new Set<string>([ConfidenceLevel.Tentative, ConfidenceLevel.Final]);

/**
 * All kernel fields must hold valid values.
 */
export function checkKernelConsistency(
  snapshot: VerificationSnapshot,
): InvariantViolation | null {
  const { kernel } = snapshot;

  if (!VALID_FORCING.has(kernel.forcing)) {
    return buildViolation(
      "kernel-consistency",
      snapshot,
      `Invalid forcing value: "${kernel.forcing}"`,
    );
  }

  if (!VALID_CAPTAIN.has(kernel.captain)) {
    return buildViolation(
      "kernel-consistency",
      snapshot,
      `Invalid captain value: "${kernel.captain}"`,
    );
  }

  // competition: string or { kind: "overcalled", level: number, strain: string }
  if (typeof kernel.competition === "string") {
    if (!VALID_COMPETITION_STRINGS.has(kernel.competition)) {
      return buildViolation(
        "kernel-consistency",
        snapshot,
        `Invalid competition string value: "${kernel.competition}"`,
      );
    }
  } else if (typeof kernel.competition === "object" && kernel.competition !== null) {
    const comp = kernel.competition;
    if (
      comp.kind !== "overcalled" ||
      typeof comp.level !== "number" ||
      typeof comp.strain !== "string"
    ) {
      return buildViolation(
        "kernel-consistency",
        snapshot,
        `Invalid competition object: ${JSON.stringify(comp)}`,
      );
    }
  } else {
    return buildViolation(
      "kernel-consistency",
      snapshot,
      `Invalid competition value: ${JSON.stringify(kernel.competition)}`,
    );
  }

  // fitAgreed: null or { strain: string, confidence: ConfidenceLevel }
  if (kernel.fitAgreed !== null) {
    if (
      typeof kernel.fitAgreed.strain !== "string" ||
      !VALID_FIT_CONFIDENCE.has(kernel.fitAgreed.confidence)
    ) {
      return buildViolation(
        "kernel-consistency",
        snapshot,
        `Invalid fitAgreed value: ${JSON.stringify(kernel.fitAgreed)}`,
      );
    }
  }

  return null;
}

// ── 3. Phase Coherence ──────────────────────────────────────────────

/**
 * Every module that appears in claims must have a corresponding entry
 * in localPhases.
 */
export function checkPhaseCoherence(
  snapshot: VerificationSnapshot,
): InvariantViolation | null {
  for (const claim of snapshot.resolved) {
    if (!snapshot.localPhases.has(claim.moduleId)) {
      return buildViolation(
        "phase-coherence",
        snapshot,
        `Module "${claim.moduleId}" has claims but no entry in localPhases`,
      );
    }
  }
  return null;
}

// ── 4. Encoding Uniqueness ──────────────────────────────────────────

/**
 * No two claims from different modules may produce the same call encoding
 * with the same recommendation band. Cross-module encoding overlap is
 * expected and resolved by the arbitration system — only flag when the
 * same band makes arbitration ambiguous.
 */
export function checkEncodingUniqueness(
  snapshot: VerificationSnapshot,
): InvariantViolation | null {
  // Key: callKey+band → moduleId
  const callBandToModule = new Map<string, string>();

  for (const claim of snapshot.resolved) {
    for (const { surface } of claim.resolved) {
      const ck = callKey(surface.encoding.defaultCall);
      const band = surface.ranking.recommendationBand;
      const key = `${ck}::${band}`;
      const existingModule = callBandToModule.get(key);
      if (existingModule !== undefined && existingModule !== claim.moduleId) {
        return buildViolation(
          "encoding-uniqueness",
          snapshot,
          `Encoding collision on ${ck} (band: ${band}): modules "${existingModule}" and "${claim.moduleId}" both claim this call at the same priority`,
        );
      }
      callBandToModule.set(key, claim.moduleId);
    }
  }

  return null;
}

// ── 5. Determinism ──────────────────────────────────────────────────

/**
 * Placeholder — true determinism checking requires re-running
 * collectMatchingClaims with modules, which are not in the snapshot.
 * Always returns null.
 */
export function checkDeterminism(
  _snapshot: VerificationSnapshot,
): InvariantViolation | null {
  return null;
}

// ── Export registry ─────────────────────────────────────────────────

export const ALL_INVARIANTS: readonly ExplorationInvariant[] = [
  { id: "arbitration-totality", severity: "warn", check: checkArbitrationTotality },
  { id: "kernel-consistency", severity: "error", check: checkKernelConsistency },
  { id: "encoding-uniqueness", severity: "error", check: checkEncodingUniqueness },
  { id: "phase-coherence", severity: "error", check: checkPhaseCoherence },
  { id: "determinism", severity: "warn", check: checkDeterminism },
];
