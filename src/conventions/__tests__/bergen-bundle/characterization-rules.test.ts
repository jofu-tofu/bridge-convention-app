/**
 * Characterization tests — Bergen bundle rule interpreter surface selection.
 */

import { describe, it, expect } from "vitest";
import { collectMatchingClaims } from "../../core/pipeline/rule-interpreter";
import type { RuleModule } from "../../core/rule-module";
import type { CommittedStep, NegotiationState } from "../../../core/contracts/committed-step";
import { INITIAL_NEGOTIATION } from "../../../core/contracts/committed-step";
import type { AuctionContext } from "../../../core/contracts/committed-step";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import { Seat } from "../../../engine/types";

import { bergenRules } from "../../definitions/modules/bergen/bergen-rules";

const allRuleModules: RuleModule[] = [bergenRules];

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
  return results.flatMap((r) => r.surfaces.map((s) => s.meaningId)).sort();
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
