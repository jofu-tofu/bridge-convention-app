/**
 * Characterization tests — Weak Two Bids rule interpreter parity with FSM.
 */

import { describe, it, expect } from "vitest";
import { collectMatchingClaims } from "../../core/pipeline/rule-interpreter";
import type { RuleModule } from "../../core/rule-module";
import type { CommittedStep, KernelState } from "../../../core/contracts/committed-step";
import { INITIAL_KERNEL } from "../../../core/contracts/committed-step";
import type { AuctionContext } from "../../../core/contracts/committed-step";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import { Seat } from "../../../engine/types";

import { weakTwosRules } from "../../definitions/modules/weak-twos/weak-twos-rules";

import { buildAuction } from "../../../engine/auction-helpers";
import { replay, computeActiveSurfaces } from "../../core/protocol/replay";
import { weakTwosConventionSpec } from "../../definitions/weak-twos-bundle/convention-spec";

const allRuleModules: RuleModule[] = [weakTwosRules];

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

function fsmSurfaceIds(bids: string[], seat: Seat = Seat.South, dealer: Seat = Seat.North): string[] {
  const auction = buildAuction(dealer, bids);
  const history = auction.entries.map((e) => ({ call: e.call, seat: e.seat }));
  const snapshot = replay(history, weakTwosConventionSpec, seat);
  const composed = computeActiveSurfaces(snapshot, weakTwosConventionSpec);
  return composed.visibleSurfaces.map((s) => s.meaningId).sort();
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
    });

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log);
      const fsmIds = fsmSurfaceIds(["2H", "P"]);
      expect(ruleIds).toEqual(fsmIds);
    });
  });

  describe("2H-P-2NT-P (Ogust — opener response)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "hearts", strength: "weak" }]),
      passStep(Seat.East),
      makeStep(Seat.South, [{ act: "inquire", feature: "suitQuality" }]),
      passStep(Seat.West),
    ];

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log, Seat.North);
      const fsmIds = fsmSurfaceIds(["2H", "P", "2NT", "P"], Seat.North);
      expect(ruleIds).toEqual(fsmIds);
    });
  });

  describe("2H-P-2NT-P-3C-P (post-Ogust — responder decides)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.North, [{ act: "open", strain: "hearts", strength: "weak" }]),
      passStep(Seat.East),
      makeStep(Seat.South, [{ act: "inquire", feature: "suitQuality" }]),
      passStep(Seat.West),
      makeStep(Seat.North, [
        { act: "show", feature: "strength", strength: "minimum" },
        { act: "show", feature: "suitQuality", quality: "bad" },
      ]),
      passStep(Seat.East),
    ];

    it("matches FSM surface IDs", () => {
      const ruleIds = ruleSurfaceIds(log);
      const fsmIds = fsmSurfaceIds(["2H", "P", "2NT", "P", "3C", "P"]);
      expect(ruleIds).toEqual(fsmIds);
    });
  });
});
