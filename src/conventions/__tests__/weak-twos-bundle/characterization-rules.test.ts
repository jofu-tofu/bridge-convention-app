/**
 * Characterization tests — Weak Two Bids rule interpreter surface selection.
 */

import { describe, it, expect } from "vitest";
import { collectMatchingClaims } from "../../core/pipeline/rule-interpreter";
import type { ConventionModule } from "../../core/convention-module";
import type { CommittedStep } from "../../../core/contracts/committed-step";
import { INITIAL_NEGOTIATION } from "../../../core/contracts/committed-step";
import type { AuctionContext } from "../../../core/contracts/committed-step";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import { Seat } from "../../../engine/types";
import { flattenSurfaces } from "../../core/pipeline/rule-interpreter";

import { getModule } from "../../definitions/module-registry";

const allRuleModules: ConventionModule[] = [getModule("weak-twos")!];

// ── Helpers ──────────────────────────────────────────────────────────

function makeStep(
  actor: Seat,
  obs: CommittedStep["publicActions"],
): CommittedStep {
  return {
    actor,
    call: { type: "pass" },
    resolvedClaim: null,
    publicActions: obs,
    negotiationDelta: {},
    stateAfter: INITIAL_NEGOTIATION,
    status: obs.length > 0 ? "resolved" : "raw-only",
  };
}

function passStep(actor: Seat): CommittedStep {
  return {
    actor,
    call: { type: "pass" },
    resolvedClaim: null,
    publicActions: [],
    negotiationDelta: {},
    stateAfter: INITIAL_NEGOTIATION,
    status: "raw-only",
  };
}

function makeContext(log: readonly CommittedStep[]): AuctionContext {
  return { snapshot: {} as PublicSnapshot, log };
}

function ruleSurfaceIds(log: readonly CommittedStep[], nextSeat: Seat = Seat.South): string[] {
  const results = collectMatchingClaims(allRuleModules, makeContext(log), nextSeat);
  return flattenSurfaces(results).map((s) => s.meaningId).sort();
}

// ── Tests ────────────────────────────────────────────────────────────

describe("Weak Two rules: characterization tests", () => {
  describe("2H-P (R1 — responder surfaces)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "hearts", strength: "weak" }]),
      passStep(Seat.East),
    ];

    it("produces R1 responder surfaces", () => {
      const ids = ruleSurfaceIds(log);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain("weak-two:game-raise-hearts");
      expect(ids).toContain("weak-two:invite-raise-hearts");
      expect(ids).toContain("weak-two:ogust-ask-hearts");
      expect(ids).toContain("weak-two:weak-pass-hearts");
    });
  });
});
