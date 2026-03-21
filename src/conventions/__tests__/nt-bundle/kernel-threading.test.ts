/**
 * Kernel threading acceptance tests — Phase 4 of continuation composition redesign.
 *
 * Verifies that buildObservationLogViaRules() produces correct postKernel and
 * publicObs at each auction step for key NT sequences.
 *
 * These tests exercise the per-step rule-based replay that replaces the old
 * inferObservationsFromCall() heuristic and the dual-run FSM model.
 */

import { describe, it, expect } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { INITIAL_KERNEL } from "../../../core/contracts/committed-step";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import type { RuleModule } from "../../core/rule-module";

import { naturalNtRules } from "../../definitions/modules/natural-nt-rules";
import { staymanRules } from "../../definitions/modules/stayman-rules";
import { jacobyTransfersRules } from "../../definitions/modules/jacoby-transfers-rules";
import { smolenRules } from "../../definitions/modules/smolen-rules";

import { buildObservationLogViaRules } from "../../../strategy/bidding/protocol-adapter";
import { collectMatchingClaims } from "../../core/pipeline/rule-interpreter";

const allRuleModules: readonly RuleModule[] = [
  naturalNtRules,
  staymanRules,
  jacobyTransfersRules,
  smolenRules,
];

// ── Helpers ──────────────────────────────────────────────────────────

function bid(level: number, strain: BidSuit): Call {
  return { type: "bid", level, strain };
}

function pass(): Call {
  return { type: "pass" };
}

type HistoryEntry = { call: Call; seat: Seat };

function makeHistory(bids: Call[], dealer: Seat = Seat.North): HistoryEntry[] {
  const seats: Seat[] = [Seat.North, Seat.East, Seat.South, Seat.West];
  const startIdx = seats.indexOf(dealer);
  return bids.map((call, i) => ({
    call,
    seat: seats[(startIdx + i) % 4]!,
  }));
}

// ── Tests ────────────────────────────────────────────────────────────

describe("Kernel threading: buildObservationLogViaRules", () => {
  describe("1NT opening", () => {
    it("produces correct kernel and observations for 1NT", () => {
      const history = makeHistory([bid(1, BidSuit.NoTrump)]);
      const log = buildObservationLogViaRules(history, Seat.South, allRuleModules);

      expect(log).toHaveLength(1);
      const step = log[0]!;
      expect(step.publicObs).toEqual([{ act: "open", strain: "notrump" }]);
      expect(step.postKernel).toEqual(INITIAL_KERNEL);
      expect(step.status).toBe("resolved");
    });
  });

  describe("1NT-P-2C (Stayman)", () => {
    it("produces forcing one-round and captain responder after 2C", () => {
      const history = makeHistory([
        bid(1, BidSuit.NoTrump),
        pass(),
        bid(2, BidSuit.Clubs),
      ]);
      const log = buildObservationLogViaRules(history, Seat.South, allRuleModules);

      expect(log).toHaveLength(3);

      // 1NT step
      expect(log[0]!.postKernel).toEqual(INITIAL_KERNEL);

      // Pass step — kernel unchanged
      expect(log[1]!.postKernel).toEqual(INITIAL_KERNEL);
      expect(log[1]!.publicObs).toEqual([]);
      expect(log[1]!.status).toBe("raw-only");

      // 2C step
      const staymanStep = log[2]!;
      expect(staymanStep.publicObs).toEqual([{ act: "inquire", feature: "majorSuit" }]);
      expect(staymanStep.postKernel).toEqual({
        ...INITIAL_KERNEL,
        forcing: "one-round",
        captain: "responder",
      });
    });
  });

  describe("1NT-P-2C-P-2D (denial)", () => {
    it("resolves forcing back to none after 2D denial", () => {
      const history = makeHistory([
        bid(1, BidSuit.NoTrump),
        pass(),
        bid(2, BidSuit.Clubs),
        pass(),
        bid(2, BidSuit.Diamonds),
      ]);
      const log = buildObservationLogViaRules(history, Seat.South, allRuleModules);

      expect(log).toHaveLength(5);

      // 2D denial step
      const denialStep = log[4]!;
      expect(denialStep.publicObs).toEqual([{ act: "deny", feature: "majorSuit" }]);
      expect(denialStep.postKernel).toEqual({
        ...INITIAL_KERNEL,
        forcing: "none",
        captain: "responder",
      });
    });
  });

  describe("1NT-P-2C-P-2H (show hearts)", () => {
    it("resolves forcing and shows hearts without agreeing fit", () => {
      const history = makeHistory([
        bid(1, BidSuit.NoTrump),
        pass(),
        bid(2, BidSuit.Clubs),
        pass(),
        bid(2, BidSuit.Hearts),
      ]);
      const log = buildObservationLogViaRules(history, Seat.South, allRuleModules);

      const showStep = log[4]!;
      expect(showStep.publicObs).toEqual([{ act: "show", feature: "heldSuit", suit: "hearts" }]);
      expect(showStep.postKernel).toEqual({
        ...INITIAL_KERNEL,
        forcing: "none",
        captain: "responder",
        fitAgreed: null,
      });
    });
  });

  describe("1NT-P-2D (transfer to hearts)", () => {
    it("produces forcing one-round and captain responder after 2D transfer", () => {
      const history = makeHistory([
        bid(1, BidSuit.NoTrump),
        pass(),
        bid(2, BidSuit.Diamonds),
      ]);
      const log = buildObservationLogViaRules(history, Seat.South, allRuleModules);

      const transferStep = log[2]!;
      expect(transferStep.publicObs).toEqual([{ act: "transfer", targetSuit: "hearts" }]);
      expect(transferStep.postKernel).toEqual({
        ...INITIAL_KERNEL,
        forcing: "one-round",
        captain: "responder",
      });
    });
  });

  describe("1NT-P-2D-P-2H (accept hearts transfer)", () => {
    it("produces tentative hearts fit after accept", () => {
      const history = makeHistory([
        bid(1, BidSuit.NoTrump),
        pass(),
        bid(2, BidSuit.Diamonds),
        pass(),
        bid(2, BidSuit.Hearts),
      ]);
      const log = buildObservationLogViaRules(history, Seat.South, allRuleModules);

      const acceptStep = log[4]!;
      expect(acceptStep.publicObs).toEqual([{ act: "accept", feature: "heldSuit", suit: "hearts" }]);
      expect(acceptStep.postKernel).toEqual({
        ...INITIAL_KERNEL,
        forcing: "none",
        captain: "responder",
        fitAgreed: { strain: "hearts", confidence: "tentative" },
      });
    });
  });

  describe("1NT-P-2C-P-2D-P-3H (Smolen)", () => {
    it("produces game-forcing with tentative spade fit after Smolen 3H", () => {
      const history = makeHistory([
        bid(1, BidSuit.NoTrump),
        pass(),
        bid(2, BidSuit.Clubs),
        pass(),
        bid(2, BidSuit.Diamonds),
        pass(),
        bid(3, BidSuit.Hearts),
      ]);
      const log = buildObservationLogViaRules(history, Seat.South, allRuleModules);

      const smolenStep = log[6]!;
      expect(smolenStep.publicObs).toContainEqual({ act: "show", feature: "shortMajor", suit: "hearts" });
      expect(smolenStep.postKernel).toEqual({
        forcing: "game",
        captain: "opener",
        fitAgreed: { strain: "spades", confidence: "tentative" },
        competition: "uncontested",
      });
    });
  });

  describe("Pass steps", () => {
    it("preserves previous kernel unchanged on pass", () => {
      const history = makeHistory([
        bid(1, BidSuit.NoTrump),
        pass(),
        bid(2, BidSuit.Clubs),
        pass(), // West passes — kernel should be same as after 2C
      ]);
      const log = buildObservationLogViaRules(history, Seat.South, allRuleModules);

      // West's pass after 2C
      const passAfter2C = log[3]!;
      expect(passAfter2C.kernelDelta).toEqual({});
      expect(passAfter2C.postKernel).toEqual(log[2]!.postKernel);
    });
  });

  describe("Parity invariant", () => {
    it("surface selection is identical with or without kernel threading", () => {
      // This verifies the critical parity invariant:
      // kernel threading MUST NOT change which surfaces are selected.
      // Since no current rules use kernel match conditions, this is automatic,
      // but this test guards against accidental coupling.
      const sequences = [
        // 1NT-P (R1)
        makeHistory([bid(1, BidSuit.NoTrump), pass()]),
        // 1NT-P-2C-P (Stayman response)
        makeHistory([bid(1, BidSuit.NoTrump), pass(), bid(2, BidSuit.Clubs), pass()]),
        // 1NT-P-2D-P (Transfer accept)
        makeHistory([bid(1, BidSuit.NoTrump), pass(), bid(2, BidSuit.Diamonds), pass()]),
      ];

      for (const history of sequences) {
        // Build log with real kernel threading
        const realLog = buildObservationLogViaRules(history, Seat.South, allRuleModules);

        // Build log with all-INITIAL_KERNEL (simulating no threading)
        const flatLog = realLog.map((step) => ({
          ...step,
          postKernel: INITIAL_KERNEL,
          kernelDelta: {},
        }));

        const nextSeat = [Seat.North, Seat.East, Seat.South, Seat.West][history.length % 4]!;

        const realSurfaces = collectMatchingClaims(
          allRuleModules,
          { snapshot: {} as never, log: realLog },
          nextSeat,
        ).flatMap((r) => r.surfaces.map((s) => s.meaningId)).sort();

        const flatSurfaces = collectMatchingClaims(
          allRuleModules,
          { snapshot: {} as never, log: flatLog },
          nextSeat,
        ).flatMap((r) => r.surfaces.map((s) => s.meaningId)).sort();

        expect(realSurfaces).toEqual(flatSurfaces);
      }
    });
  });
});
