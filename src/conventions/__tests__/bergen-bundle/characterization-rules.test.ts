/**
 * Characterization tests — Bergen bundle rule interpreter parity with FSM.
 *
 * Verifies that the rule interpreter produces the same surface meaningIds
 * as the FSM-based protocol adapter for key Bergen auction sequences.
 */

import { describe, it, expect } from "vitest";
import { collectMatchingClaims } from "../../core/pipeline/rule-interpreter";
import type { RuleModule } from "../../core/rule-module";
import type { CommittedStep, KernelState } from "../../../core/contracts/committed-step";
import { INITIAL_KERNEL } from "../../../core/contracts/committed-step";
import type { AuctionContext } from "../../../core/contracts/committed-step";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import { Seat } from "../../../engine/types";

import { bergenRules } from "../../definitions/modules/bergen/bergen-rules";

// FSM comparison
import { buildAuction } from "../../../engine/auction-helpers";
import { replay, computeActiveSurfaces } from "../../core/protocol/replay";
import { bergenConventionSpec } from "../../definitions/bergen-bundle/convention-spec";

const allRuleModules: RuleModule[] = [bergenRules];
const bergenSpec = bergenConventionSpec;

// ── Helpers ──────────────────────────────────────────────────────────

function makeStep(
  actor: Seat,
  obs: CommittedStep["publicObs"],
  prevKernel: KernelState = INITIAL_KERNEL,
): CommittedStep {
  return {
    actor,
    call: { type: "pass" },
    resolvedClaim: null,
    publicObs: obs,
    kernelDelta: {},
    postKernel: prevKernel,
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

function ruleSurfaceIds(log: readonly CommittedStep[], nextSeat: Seat = Seat.South): string[] {
  const results = collectMatchingClaims(allRuleModules, makeContext(log), nextSeat);
  return results.flatMap((r) => r.surfaces.map((s) => s.meaningId)).sort();
}

function fsmSurfaceIds(bids: string[], seat: Seat = Seat.South, dealer: Seat = Seat.North): string[] {
  const auction = buildAuction(dealer, bids);
  const history = auction.entries.map((e) => ({ call: e.call, seat: e.seat }));
  const snapshot = replay(history, bergenSpec, seat);
  const composed = computeActiveSurfaces(snapshot, bergenSpec);
  return composed.visibleSurfaces.map((s) => s.meaningId).sort();
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
    });

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log);
      const fsmIds = fsmSurfaceIds(["1H", "P"]);
      expect(ruleIds).toEqual(fsmIds);
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
    });

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log);
      const fsmIds = fsmSurfaceIds(["1S", "P"]);
      expect(ruleIds).toEqual(fsmIds);
    });
  });

  describe("1H-P-3C-P (after constructive — opener surfaces)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "hearts" }]),
      passStep(Seat.East),
      makeStep(Seat.South, [{ act: "raise", strain: "hearts", strength: "constructive" }]),
      passStep(Seat.West),
    ];

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log, Seat.North);
      const fsmIds = fsmSurfaceIds(["1H", "P", "3C", "P"], Seat.North);
      expect(ruleIds).toEqual(fsmIds);
    });
  });

  describe("1H-P-3D-P (after limit — opener surfaces)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "hearts" }]),
      passStep(Seat.East),
      makeStep(Seat.South, [{ act: "raise", strain: "hearts", strength: "limit" }]),
      passStep(Seat.West),
    ];

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log, Seat.North);
      const fsmIds = fsmSurfaceIds(["1H", "P", "3D", "P"], Seat.North);
      expect(ruleIds).toEqual(fsmIds);
    });
  });

  describe("1H-P-3H-P (after preemptive — opener surfaces)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "hearts" }]),
      passStep(Seat.East),
      makeStep(Seat.South, [{ act: "raise", strain: "hearts", strength: "preemptive" }]),
      passStep(Seat.West),
    ];

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log, Seat.North);
      const fsmIds = fsmSurfaceIds(["1H", "P", "3H", "P"], Seat.North);
      expect(ruleIds).toEqual(fsmIds);
    });
  });
});
