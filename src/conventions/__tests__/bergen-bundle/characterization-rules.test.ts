/**
 * Characterization tests — Bergen bundle rule interpreter surface selection.
 */

import { describe, it, expect } from "vitest";
import { collectMatchingClaims } from "../../pipeline/rule-interpreter";
import type { ConventionModule } from "../../core/convention-module";
import type { CommittedStep, NegotiationState } from "../../core/committed-step";
import { INITIAL_NEGOTIATION } from "../../core/committed-step";
import type { AuctionContext } from "../../core/committed-step";
import type { PublicSnapshot } from "../../core/module-surface";
import { Seat } from "../../../engine/types";
import { flattenSurfaces } from "../../pipeline/rule-interpreter";

import { getModule } from "../../definitions/module-registry";

const allRuleModules: ConventionModule[] = [getModule("bergen")!];

// ── Helpers ──────────────────────────────────────────────────────────

function makeStep(
  actor: Seat,
  obs: CommittedStep["publicActions"],
  prevKernel: NegotiationState = INITIAL_NEGOTIATION,
): CommittedStep {
  return {
    actor,
    call: { type: "pass" },
    resolvedClaim: null,
    publicActions: obs,
    negotiationDelta: {},
    stateAfter: prevKernel,
    status: obs.length > 0 ? "resolved" : "raw-only",
  };
}

function passStep(actor: Seat, prevKernel: NegotiationState = INITIAL_NEGOTIATION): CommittedStep {
  return {
    actor,
    call: { type: "pass" },
    resolvedClaim: null,
    publicActions: [],
    negotiationDelta: {},
    stateAfter: prevKernel,
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

describe("Bergen rules: characterization tests", () => {
  describe("1H-P (R1 hearts — responder surfaces)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "hearts" }]),
      passStep(Seat.East),
    ];

    it("produces R1 hearts responder surfaces", () => {
      const ids = ruleSurfaceIds(log);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain("bergen:constructive-raise-hearts");
      expect(ids).toContain("bergen:game-raise-hearts");
      expect(ids).toContain("bergen:limit-raise-hearts");
      expect(ids).toContain("bergen:preemptive-raise-hearts");
      expect(ids).toContain("bergen:splinter-hearts");
    });

  });

  describe("1S-P (R1 spades — responder surfaces)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "spades" }]),
      passStep(Seat.East),
    ];

    it("produces R1 spades responder surfaces", () => {
      const ids = ruleSurfaceIds(log);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain("bergen:constructive-raise-spades");
      expect(ids).toContain("bergen:game-raise-spades");
      expect(ids).toContain("bergen:limit-raise-spades");
      expect(ids).toContain("bergen:preemptive-raise-spades");
      expect(ids).toContain("bergen:splinter-spades");
    });
  });
});
