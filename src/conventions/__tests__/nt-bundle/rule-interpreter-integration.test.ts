/**
 * Integration tests: rule interpreter produces same surfaces as current FSM.
 *
 * Uses all four rule modules (natural-nt, stayman, jacoby-transfers, smolen)
 * with the rule interpreter, and verifies the collected surface meaningIds
 * match what the FSM-based protocol adapter produces for the same auctions.
 *
 * This validates that the rule interpreter is a correct replacement for the
 * old FSM surface selection mechanism.
 */

import { describe, it, expect } from "vitest";
import { collectMatchingClaims } from "../../core/pipeline/rule-interpreter";
import type { RuleModule } from "../../core/rule-module";
import type { AuctionContext, CommittedStep, KernelState } from "../../../core/contracts/committed-step";
import { INITIAL_KERNEL } from "../../../core/contracts/committed-step";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import { Seat } from "../../../engine/types";

// Rule modules under test
import { naturalNtRules } from "../../definitions/modules/natural-nt-rules";
import { staymanRules } from "../../definitions/modules/stayman-rules";
import { jacobyTransfersRules } from "../../definitions/modules/jacoby-transfers-rules";
import { smolenRules } from "../../definitions/modules/smolen-rules";

// Also test against FSM-based pipeline for comparison
import { buildAuction } from "../../../engine/auction-helpers";
import { specFromSystem, ntSystem } from "../../definitions/system-registry";
import { replay, computeActiveSurfaces } from "../../core/protocol/replay";

const allRuleModules: RuleModule[] = [
  naturalNtRules,
  staymanRules,
  jacobyTransfersRules,
  smolenRules,
];

const ntSpec = specFromSystem(ntSystem)!;

// ── Helpers ──────────────────────────────────────────────────────────

function makeStep(
  actor: Seat,
  obs: CommittedStep["publicObs"],
  kernelOverrides: Partial<KernelState> = {},
): CommittedStep {
  return {
    actor,
    call: { type: "pass" },
    resolvedClaim: null,
    publicObs: obs,
    kernelDelta: {},
    postKernel: { ...INITIAL_KERNEL, ...kernelOverrides },
    status: obs.length > 0 ? "resolved" : "raw-only",
  };
}

function passStep(actor: Seat, prevKernel: KernelState = INITIAL_KERNEL): CommittedStep {
  return {
    actor,
    call: { type: "pass" },
    resolvedClaim: null,
    publicObs: [],
    kernelDelta: {},
    postKernel: prevKernel,
    status: "raw-only",
  };
}

function makeContext(log: readonly CommittedStep[]): AuctionContext {
  return { snapshot: {} as PublicSnapshot, log };
}

/** Get surface IDs from the FSM-based protocol adapter for comparison. */
function fsmSurfaceIds(bids: string[], seat: Seat = Seat.South): string[] {
  const auction = buildAuction(Seat.North, bids);
  const history = auction.entries.map((e) => ({ call: e.call, seat: e.seat }));
  const snapshot = replay(history, ntSpec, seat);
  const composed = computeActiveSurfaces(snapshot, ntSpec);
  return composed.visibleSurfaces.map((s) => s.meaningId).sort();
}

/** Get surface IDs from the rule interpreter. */
function ruleSurfaceIds(log: readonly CommittedStep[], nextSeat: Seat = Seat.South): string[] {
  const results = collectMatchingClaims(allRuleModules, makeContext(log), nextSeat);
  return results.flatMap((r) => r.surfaces.map((s) => s.meaningId)).sort();
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

    it("matches FSM surface count", () => {
      const ruleIds = ruleSurfaceIds(log);
      const fsmIds = fsmSurfaceIds(["1NT", "P"]);
      expect(ruleIds.length).toBe(fsmIds.length);
    });

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log);
      const fsmIds = fsmSurfaceIds(["1NT", "P"]);
      expect(ruleIds).toEqual(fsmIds);
    });
  });

  describe("1NT-P-2C-P (Stayman — opener response)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "notrump" }]),
      passStep(Seat.East),
      makeStep(Seat.South, [{ act: "inquire", feature: "majorSuit" }]),
      passStep(Seat.West),
    ];

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log, Seat.North);
      const fsmIds = fsmSurfaceIds(["1NT", "P", "2C", "P"], Seat.North);
      expect(ruleIds).toEqual(fsmIds);
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

    it("matches FSM surface IDs (including Smolen)", () => {
      const ruleIds = ruleSurfaceIds(log);
      const fsmIds = fsmSurfaceIds(["1NT", "P", "2C", "P", "2D", "P"]);
      expect(ruleIds).toEqual(fsmIds);
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

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log);
      const fsmIds = fsmSurfaceIds(["1NT", "P", "2C", "P", "2H", "P"]);
      expect(ruleIds).toEqual(fsmIds);
    });
  });

  describe("1NT-P-2D-P (Transfer — opener accepts)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "notrump" }]),
      passStep(Seat.East),
      makeStep(Seat.South, [{ act: "transfer", targetSuit: "hearts" }]),
      passStep(Seat.West),
    ];

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log, Seat.North);
      const fsmIds = fsmSurfaceIds(["1NT", "P", "2D", "P"], Seat.North);
      expect(ruleIds).toEqual(fsmIds);
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

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log);
      const fsmIds = fsmSurfaceIds(["1NT", "P", "2D", "P", "2H", "P"]);
      expect(ruleIds).toEqual(fsmIds);
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
      const smolenIds = smolenResult!.surfaces.map((s) => s.meaningId);
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
        const smolenR3 = smolenResult.surfaces.filter(
          (s) => s.meaningId.startsWith("smolen:bid-short"),
        );
        expect(smolenR3).toHaveLength(0);
      }
    });
  });
});
