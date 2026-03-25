/**
 * Integration tests: rule interpreter surface selection for NT bundle.
 *
 * Uses all four rule modules (natural-nt, stayman, jacoby-transfers, smolen)
 * with the rule interpreter, verifying correct surface activation for
 * key auction sequences.
 */

import { describe, it, expect } from "vitest";
import { collectMatchingClaims } from "../../pipeline/observation/rule-interpreter";
import type { ConventionModule } from "../../core/convention-module";
import type { AuctionContext, CommittedStep, NegotiationState } from "../../core/committed-step";
import { INITIAL_NEGOTIATION } from "../../core/committed-step";
import type { PublicSnapshot } from "../../core/module-surface";
import { Seat } from "../../../engine/types";

// Rule modules under test
import { getModules } from "../../definitions/module-registry";

const allRuleModules: ConventionModule[] = [
  ...getModules(["natural-nt", "stayman", "jacoby-transfers", "smolen"]),
];

// ── Helpers ──────────────────────────────────────────────────────────

function makeStep(
  actor: Seat,
  obs: CommittedStep["publicActions"],
  kernelOverrides: Partial<NegotiationState> = {},
): CommittedStep {
  return {
    actor,
    call: { type: "pass" },
    resolvedClaim: null,
    publicActions: obs,
    negotiationDelta: {},
    stateAfter: { ...INITIAL_NEGOTIATION, ...kernelOverrides },
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

/** Get surface IDs from the rule interpreter. */
function ruleSurfaceIds(log: readonly CommittedStep[], nextSeat: Seat = Seat.South): string[] {
  const results = collectMatchingClaims(allRuleModules, makeContext(log), nextSeat);
  return results.flatMap((r) => r.resolved.map((c) => c.surface.meaningId)).sort();
}

// ── Tests ────────────────────────────────────────────────────────────

describe("Rule interpreter integration: NT bundle", () => {
  describe("1NT-P (R1 — responder surfaces)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "notrump" }]),
      passStep(Seat.East),
    ];

    it("rule interpreter produces R1 responder surfaces", () => {
      const ids = ruleSurfaceIds(log);
      // Should include NT invite, 3NT game, Stayman ask, transfers, and Smolen entries
      expect(ids.length).toBeGreaterThan(0);
    });
  });

  describe("1NT-P-2C-P (Stayman — opener response)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "notrump" }]),
      passStep(Seat.East),
      makeStep(Seat.South, [{ act: "inquire", feature: "majorSuit" }]),
      passStep(Seat.West),
    ];

    it("produces opener response surfaces", () => {
      const ruleIds = ruleSurfaceIds(log, Seat.North);
      expect(ruleIds.length).toBeGreaterThan(0);
    });
  });

  describe("1NT-P-2C-P-2D-P (Stayman R3 after denial)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "notrump" }]),
      passStep(Seat.East),
      makeStep(Seat.South, [{ act: "inquire", feature: "majorSuit" }]),
      passStep(Seat.West),
      makeStep(Seat.North, [{ act: "deny", feature: "majorSuit" }]),
      passStep(Seat.East),
    ];

    it("produces R3 surfaces including Smolen", () => {
      const ruleIds = ruleSurfaceIds(log);
      expect(ruleIds.length).toBeGreaterThan(0);
    });

    it("includes Smolen R3 surfaces via route matching", () => {
      const ruleIds = ruleSurfaceIds(log);
      // Smolen R3 surfaces should be present because of the subseq(inquire, deny) pattern
      const smolenSurfaces = ruleIds.filter((id) => id.startsWith("smolen:"));
      expect(smolenSurfaces.length).toBeGreaterThan(0);
    });
  });

  describe("1NT-P-2C-P-2H-P (Stayman R3 after hearts shown)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "notrump" }]),
      passStep(Seat.East),
      makeStep(Seat.South, [{ act: "inquire", feature: "majorSuit" }]),
      passStep(Seat.West),
      makeStep(Seat.North, [{ act: "show", feature: "heldSuit", suit: "hearts" }]),
      passStep(Seat.East),
    ];

    it("produces R3 surfaces after hearts shown", () => {
      const ruleIds = ruleSurfaceIds(log);
      expect(ruleIds.length).toBeGreaterThan(0);
    });
  });

  describe("1NT-P-2D-P (Transfer — opener accepts)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "notrump" }]),
      passStep(Seat.East),
      makeStep(Seat.South, [{ act: "transfer", targetSuit: "hearts" }]),
      passStep(Seat.West),
    ];

    it("produces transfer accept surfaces", () => {
      const ruleIds = ruleSurfaceIds(log, Seat.North);
      expect(ruleIds.length).toBeGreaterThan(0);
    });
  });

  describe("1NT-P-2D-P-2H-P (Transfer R3 after accept)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "notrump" }]),
      passStep(Seat.East),
      makeStep(Seat.South, [{ act: "transfer", targetSuit: "hearts" }]),
      passStep(Seat.West),
      makeStep(Seat.North, [{ act: "accept", feature: "heldSuit", suit: "hearts" }]),
      passStep(Seat.East),
    ];

    it("produces R3 surfaces after transfer accept", () => {
      const ruleIds = ruleSurfaceIds(log);
      expect(ruleIds.length).toBeGreaterThan(0);
    });
  });

  describe("Smolen proof case: no hookTransitions needed", () => {
    it("Smolen R3 surfaces activate via route pattern, not FSM state ID", () => {
      // After Stayman inquiry + denial, Smolen's route pattern fires
      const log: CommittedStep[] = [
        makeStep(Seat.North, [{ act: "open", strain: "notrump" }]),
        passStep(Seat.East),
        makeStep(Seat.South, [{ act: "inquire", feature: "majorSuit" }]),
        passStep(Seat.West),
        makeStep(Seat.North, [{ act: "deny", feature: "majorSuit" }]),
        passStep(Seat.East),
      ];

      const results = collectMatchingClaims(allRuleModules, makeContext(log));
      const smolenResult = results.find((r) => r.moduleId === "smolen");

      expect(smolenResult).toBeDefined();
      const smolenIds = smolenResult!.resolved.map((c) => c.surface.meaningId);
      expect(smolenIds).toContain("smolen:bid-short-hearts");
      expect(smolenIds).toContain("smolen:bid-short-spades");
    });

    it("Smolen R3 surfaces do NOT activate without the denial", () => {
      // After Stayman inquiry + hearts shown (not denied), Smolen should not fire
      const log: CommittedStep[] = [
        makeStep(Seat.North, [{ act: "open", strain: "notrump" }]),
        passStep(Seat.East),
        makeStep(Seat.South, [{ act: "inquire", feature: "majorSuit" }]),
        passStep(Seat.West),
        makeStep(Seat.North, [{ act: "show", feature: "heldSuit", suit: "hearts" }]),
        passStep(Seat.East),
      ];

      const results = collectMatchingClaims(allRuleModules, makeContext(log));
      const smolenResult = results.find((r) => r.moduleId === "smolen");

      // Smolen may still contribute its R1 entries but should NOT contribute R3 surfaces
      if (smolenResult) {
        const smolenR3 = smolenResult.resolved.filter(
          (c) => c.surface.meaningId.startsWith("smolen:bid-short"),
        );
        expect(smolenR3).toHaveLength(0);
      }
    });
  });
});
