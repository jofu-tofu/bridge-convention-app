/**
 * Characterization tests — DONT rule interpreter parity with FSM.
 */

import { describe, it, expect } from "vitest";
import { collectMatchingClaims } from "../../core/pipeline/rule-interpreter";
import type { RuleModule } from "../../core/rule-module";
import type { CommittedStep } from "../../../core/contracts/committed-step";
import { INITIAL_KERNEL } from "../../../core/contracts/committed-step";
import type { AuctionContext } from "../../../core/contracts/committed-step";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import { Seat } from "../../../engine/types";

import { dontRules } from "../../definitions/modules/dont/dont-rules";

import { buildAuction } from "../../../engine/auction-helpers";
import { replay, computeActiveSurfaces } from "../../core/protocol/replay";
import { dontConventionSpec } from "../../definitions/dont-bundle/convention-spec";

const allRuleModules: RuleModule[] = [dontRules];

// ── Helpers ──────────────────────────────────────────────────────────

function makeStep(
  actor: Seat,
  obs: CommittedStep["publicObs"],
): CommittedStep {
  return {
    actor,
    call: { type: "pass" },
    resolvedClaim: null,
    publicObs: obs,
    kernelDelta: {},
    postKernel: INITIAL_KERNEL,
    status: obs.length > 0 ? "resolved" : "raw-only",
  };
}

function passStep(actor: Seat): CommittedStep {
  return {
    actor,
    call: { type: "pass" },
    resolvedClaim: null,
    publicObs: [],
    kernelDelta: {},
    postKernel: INITIAL_KERNEL,
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

function fsmSurfaceIds(bids: string[], seat: Seat = Seat.South, dealer: Seat = Seat.East): string[] {
  const auction = buildAuction(dealer, bids);
  const history = auction.entries.map((e) => ({ call: e.call, seat: e.seat }));
  const snapshot = replay(history, dontConventionSpec, seat);
  const composed = computeActiveSurfaces(snapshot, dontConventionSpec);
  return composed.visibleSurfaces.map((s) => s.meaningId).sort();
}

// ── Tests ────────────────────────────────────────────────────────────

describe("DONT rules: characterization tests", () => {
  describe("1NT (R1 — overcaller surfaces)", () => {
    // East opens 1NT, overcaller (South) bids
    const log: CommittedStep[] = [
      makeStep(Seat.East, [{ act: "open", strain: "notrump" }]),
    ];

    it("produces R1 overcaller surfaces", () => {
      // DONT omits match.turn, so we don't pass nextSeat for turn matching.
      // However, we still pass South for rule matching (collectMatchingClaims
      // uses it for deriveTurnRole, which DONT rules don't check).
      const ids = ruleSurfaceIds(log, Seat.South);
      expect(ids.length).toBeGreaterThan(0);
    });

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log, Seat.South);
      const fsmIds = fsmSurfaceIds(["1NT"]);
      expect(ruleIds).toEqual(fsmIds);
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

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log, Seat.North);
      const fsmIds = fsmSurfaceIds(["1NT", "2H", "P"], Seat.North);
      expect(ruleIds).toEqual(fsmIds);
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

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log, Seat.North);
      const fsmIds = fsmSurfaceIds(["1NT", "2D", "P"], Seat.North);
      expect(ruleIds).toEqual(fsmIds);
    });
  });
});
