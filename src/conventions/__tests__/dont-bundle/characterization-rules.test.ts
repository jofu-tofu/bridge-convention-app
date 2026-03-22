/**
 * Characterization tests — DONT rule interpreter surface selection.
 */

import { describe, it, expect } from "vitest";
import { collectMatchingClaims } from "../../pipeline/rule-interpreter";
import type { ConventionModule } from "../../core/convention-module";
import type { CommittedStep } from "../../../core/contracts/committed-step";
import { INITIAL_NEGOTIATION } from "../../../core/contracts/committed-step";
import type { AuctionContext } from "../../../core/contracts/committed-step";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import { Seat } from "../../../engine/types";
import { flattenSurfaces } from "../../pipeline/rule-interpreter";

import { getModule } from "../../definitions/module-registry";

const allRuleModules: ConventionModule[] = [getModule("dont")!];

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

describe("DONT rules: characterization tests", () => {
  describe("1NT (R1 — overcaller surfaces)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.East, [{ act: "open", strain: "notrump" }]),
    ];

    it("produces R1 overcaller surfaces", () => {
      const ids = ruleSurfaceIds(log, Seat.South);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain("dont:both-majors-2h");
      expect(ids).toContain("dont:clubs-higher-2c");
      expect(ids).toContain("dont:diamonds-major-2d");
      expect(ids).toContain("dont:natural-spades-2s");
      expect(ids).toContain("dont:overcaller-pass");
      expect(ids).toContain("dont:single-suited-double");
    });
  });

  describe("1NT-2H-P (advancer after 2H — both majors)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.East, [{ act: "open", strain: "notrump" }]),
      makeStep(Seat.South, [
        { act: "overcall", feature: "twoSuited" },
        { act: "show", feature: "heldSuit", suit: "hearts" },
        { act: "show", feature: "heldSuit", suit: "spades" },
      ]),
      passStep(Seat.West),
    ];

    it("produces advancer surfaces after 2H", () => {
      const ruleIds = ruleSurfaceIds(log, Seat.North);
      expect(ruleIds.length).toBeGreaterThan(0);
      expect(ruleIds).toContain("dont:accept-hearts-pass");
      expect(ruleIds).toContain("dont:escape-clubs-3c");
      expect(ruleIds).toContain("dont:escape-diamonds-3d");
      expect(ruleIds).toContain("dont:prefer-spades-2s");
    });
  });

  describe("1NT-2D-P (advancer after 2D — diamonds + major)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.East, [{ act: "open", strain: "notrump" }]),
      makeStep(Seat.South, [
        { act: "overcall", feature: "twoSuited" },
        { act: "show", feature: "heldSuit", suit: "diamonds" },
      ]),
      passStep(Seat.West),
    ];

    it("produces advancer surfaces after 2D", () => {
      const ruleIds = ruleSurfaceIds(log, Seat.North);
      expect(ruleIds.length).toBeGreaterThan(0);
      expect(ruleIds).toContain("dont:accept-diamonds-pass");
      expect(ruleIds).toContain("dont:relay-2h-after-2d");
    });
  });
});
