import { describe, it, expect } from "vitest";
import { BidSuit, Seat } from "../../../engine/types";
import { buildAuction } from "../../../engine/auction-helpers";
import {
  computeDialogueState,
  INITIAL_DIALOGUE_STATE,
} from "../../core/dialogue/dialogue-manager";
import {
  ForcingState,
  PendingAction,
  CompetitionMode,
  CaptainRole,
  SystemMode,
  InterferenceKind,
  getSystemModeFor,
} from "../../core/dialogue/dialogue-state";
import type { TransitionRule } from "../../core/dialogue";
import { applyEffect, applyBackfillEffect } from "../../core/dialogue";
import { STAYMAN_CAPABILITY } from "../../definitions/stayman/constants";
import { baselineTransitionRules } from "../../core/dialogue/baseline-transitions";
import { staymanTransitionRules } from "../../definitions/stayman/transitions";
import { bergenTransitionRules } from "../../definitions/bergen-raises/transitions";
import { weakTwoTransitionRules } from "../../definitions/weak-twos/transitions";
import { saycTransitionRules } from "../../definitions/sayc/transitions";
import { lebensohlTransitionRules } from "../../definitions/lebensohl-lite/transitions";

// Helper: call computeDialogueState with two-pass mode (matching production config)
function computeStaymanState(auction: import("../../../engine/types").Auction) {
  return computeDialogueState(auction, staymanTransitionRules, baselineTransitionRules);
}
const bergenRules: readonly TransitionRule[] = [
  ...bergenTransitionRules,
  ...baselineTransitionRules,
];
const weakTwoRules: readonly TransitionRule[] = [
  ...weakTwoTransitionRules,
  ...baselineTransitionRules,
];
const saycRules: readonly TransitionRule[] = [
  ...saycTransitionRules,
  ...baselineTransitionRules,
];
const lebensohlRules: readonly TransitionRule[] = [
  ...lebensohlTransitionRules,
  ...baselineTransitionRules,
];

describe("DialogueState foundation", () => {
  describe("initial state", () => {
    it("returns default state for empty auction", () => {
      const auction = buildAuction(Seat.North, []);
      const state = computeStaymanState(auction);

      expect(state).toEqual(INITIAL_DIALOGUE_STATE);
      expect(state.familyId).toBeNull();
      expect(state.forcingState).toBe(ForcingState.Nonforcing);
      expect(state.pendingAction).toBe(PendingAction.None);
      expect(state.competitionMode).toBe(CompetitionMode.Uncontested);
      expect(state.captain).toBe(CaptainRole.Neither);
      expect(state.systemMode).toBe(SystemMode.Off);
    });
  });

  describe("1NT opening detection", () => {
    it("detects 1NT opening and sets family state", () => {
      const auction = buildAuction(Seat.North, ["1NT"]);
      const state = computeStaymanState(auction);

      expect(state.familyId).toBe("1nt");
      expect(state.captain).toBe(CaptainRole.Responder);
      expect(state.systemMode).toBe(SystemMode.On);
    });
  });

  describe("Stayman ask (1NT-P-2C)", () => {
    it("sets pending action and forcing state after Stayman ask", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P", "2C"]);
      const state = computeStaymanState(auction);

      expect(state.familyId).toBe("1nt");
      expect(state.pendingAction).toBe(PendingAction.ShowMajor);
      expect(state.forcingState).toBe(ForcingState.ForcingOneRound);
      expect(state.captain).toBe(CaptainRole.Responder);
    });
  });

  describe("Stayman response (1NT-P-2C-P-2H)", () => {
    it("sets tentative heart agreement after 2H response", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2H"]);
      const state = computeStaymanState(auction);

      expect(state.pendingAction).toBe(PendingAction.None);
      expect(state.agreedStrain).toEqual({
        type: "suit",
        suit: "H",
        confidence: "tentative",
      });
    });

    it("sets tentative spade agreement after 2S response", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2S"]);
      const state = computeStaymanState(auction);

      expect(state.agreedStrain).toEqual({
        type: "suit",
        suit: "S",
        confidence: "tentative",
      });
    });

    it("sets no agreement after 2D denial", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D"]);
      const state = computeStaymanState(auction);

      expect(state.agreedStrain).toEqual({ type: "none" });
      expect(state.pendingAction).toBe(PendingAction.None);
    });
  });

  describe("interference handling", () => {
    it("sets competition mode after opponent doubles 1NT", () => {
      const auction = buildAuction(Seat.North, ["1NT", "X"]);
      const state = computeStaymanState(auction);

      expect(state.competitionMode).toBe(CompetitionMode.Doubled);
      // Global systemMode is Off (baseline backfill); Stayman capability is Modified
      expect(state.systemMode).toBe(SystemMode.Off);
      expect(getSystemModeFor(state, STAYMAN_CAPABILITY)).toBe(SystemMode.Modified);
    });

    it("sets competition mode after opponent overcalls", () => {
      const auction = buildAuction(Seat.North, ["1NT", "2H"]);
      const state = computeStaymanState(auction);

      expect(state.competitionMode).toBe(CompetitionMode.Overcalled);
      expect(state.systemMode).toBe(SystemMode.Off);
    });
  });

  describe("transition rule precedence", () => {
    it("family-specific rules take precedence over baseline rules", () => {
      // 2C after 1NT should be Stayman ask (family rule), not a natural bid
      const auction = buildAuction(Seat.North, ["1NT", "P", "2C"]);
      const state = computeStaymanState(auction);

      // Family rule sets ShowMajor; baseline would not
      expect(state.pendingAction).toBe(PendingAction.ShowMajor);
    });
  });

  describe("determinism", () => {
    it("produces identical output for same inputs across 100 replays", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2H"]);

      const first = computeStaymanState(auction);
      for (let i = 0; i < 100; i++) {
        const result = computeStaymanState(auction);
        expect(result).toEqual(first);
      }
    });
  });

  describe("pass handling", () => {
    it("passes through state unchanged for pass bids", () => {
      // After 1NT, the pass by East should not change the state set by 1NT
      const afterNT = computeStaymanState(
        buildAuction(Seat.North, ["1NT"]),
      );
      const afterPass = computeStaymanState(
        buildAuction(Seat.North, ["1NT", "P"]),
      );

      expect(afterPass.familyId).toBe(afterNT.familyId);
      expect(afterPass.systemMode).toBe(afterNT.systemMode);
      expect(afterPass.captain).toBe(afterNT.captain);
    });
  });

  describe("Stayman interference transitions", () => {
    it("1NT-X with Stayman rules: global systemMode Off, stayman capability Modified", () => {
      const auction = buildAuction(Seat.North, ["1NT", "X"]);
      const state = computeStaymanState(auction);

      expect(state.familyId).toBe("1nt");
      expect(state.competitionMode).toBe(CompetitionMode.Doubled);
      expect(state.systemMode).toBe(SystemMode.Off);
      expect(getSystemModeFor(state, STAYMAN_CAPABILITY)).toBe(SystemMode.Modified);
    });

    it("1NT-X with baseline-only rules sets Off systemMode", () => {
      const auction = buildAuction(Seat.North, ["1NT", "X"]);
      const state = computeDialogueState(auction, baselineTransitionRules);

      expect(state.competitionMode).toBe(CompetitionMode.Doubled);
      expect(state.systemMode).toBe(SystemMode.Off);
    });

    it("1NT-2H overcall sets Overcalled + Off even with Stayman rules", () => {
      const auction = buildAuction(Seat.North, ["1NT", "2H"]);
      const state = computeStaymanState(auction);

      expect(state.familyId).toBe("1nt");
      expect(state.competitionMode).toBe(CompetitionMode.Overcalled);
      expect(state.systemMode).toBe(SystemMode.Off);
    });
  });

  describe("baseline-only rules", () => {
    it("handles auction with only baseline rules (no family)", () => {
      // Without family rules, only baseline rules apply
      const auction = buildAuction(Seat.North, ["1NT"]);
      const state = computeDialogueState(auction, baselineTransitionRules);

      // Baseline detects 1NT opening
      expect(state.familyId).toBe("1nt");
    });
  });

  describe("interferenceDetail", () => {
    it("populates interferenceDetail on 1NT-2H overcall", () => {
      const auction = buildAuction(Seat.North, ["1NT", "2H"]);
      const state = computeStaymanState(auction);

      expect(state.interferenceDetail).toBeDefined();
      expect(state.interferenceDetail!.call).toEqual({ type: "bid", level: 2, strain: "H" });
      expect(state.interferenceDetail!.seat).toBe(Seat.East);
      expect(state.interferenceDetail!.isNatural).toBe(true);
    });

    it("populates interferenceDetail on 1NT-X double", () => {
      const auction = buildAuction(Seat.North, ["1NT", "X"]);
      const state = computeStaymanState(auction);

      expect(state.interferenceDetail).toBeDefined();
      expect(state.interferenceDetail!.call).toEqual({ type: "double" });
      expect(state.interferenceDetail!.seat).toBe(Seat.East);
    });

    it("interferenceDetail undefined for uncontested auction", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P"]);
      const state = computeStaymanState(auction);

      expect(state.interferenceDetail).toBeUndefined();
    });

    it("opponent double → interferenceDetail.kind is Unknown", () => {
      const auction = buildAuction(Seat.North, ["1NT", "X"]);
      const state = computeStaymanState(auction);

      expect(state.interferenceDetail).toBeDefined();
      expect(state.interferenceDetail!.kind).toBe(InterferenceKind.Unknown);
    });

    it("opponent overcall → interferenceDetail.kind is NaturalOvercall", () => {
      const auction = buildAuction(Seat.North, ["1NT", "2H"]);
      const state = computeStaymanState(auction);

      expect(state.interferenceDetail).toBeDefined();
      expect(state.interferenceDetail!.kind).toBe(InterferenceKind.NaturalOvercall);
    });

    it("existing overlay matches() calls unchanged (characterization)", () => {
      const doubleAuction = buildAuction(Seat.North, ["1NT", "X"]);
      const overcallAuction = buildAuction(Seat.North, ["1NT", "2H"]);
      const doubleState = computeStaymanState(doubleAuction);
      const overcallState = computeStaymanState(overcallAuction);

      expect(doubleState.competitionMode).toBe(CompetitionMode.Doubled);
      expect(overcallState.competitionMode).toBe(CompetitionMode.Overcalled);
    });
  });

  describe("typed DialogueEffect (set* prefix)", () => {
    it("applyEffect with setFamilyId produces correct state", () => {
      const result = applyEffect(INITIAL_DIALOGUE_STATE, {
        setFamilyId: "1nt",
      });
      expect(result.familyId).toBe("1nt");
      // Other fields unchanged
      expect(result.forcingState).toBe(ForcingState.Nonforcing);
      expect(result.systemMode).toBe(SystemMode.Off);
    });

    it("applyEffect with setFamilyId=null clears familyId", () => {
      const stateWithFamily = applyEffect(INITIAL_DIALOGUE_STATE, {
        setFamilyId: "1nt",
      });
      const result = applyEffect(stateWithFamily, { setFamilyId: null });
      expect(result.familyId).toBeNull();
    });

    it("applyEffect with mergeConventionData merges (not replaces) existing keys", () => {
      const state1 = applyEffect(INITIAL_DIALOGUE_STATE, {
        mergeConventionData: { openerSeat: Seat.North },
      });
      const state2 = applyEffect(state1, {
        mergeConventionData: { showed: "hearts" },
      });
      expect(state2.conventionData["openerSeat"]).toBe(Seat.North);
      expect(state2.conventionData["showed"]).toBe("hearts");
    });

    it("activateOverlay accepted without error (stored nowhere yet)", () => {
      const result = applyEffect(INITIAL_DIALOGUE_STATE, {
        activateOverlay: "stayman-contested",
      });
      // activateOverlay is accepted but not stored — state unchanged
      expect(result).toEqual(INITIAL_DIALOGUE_STATE);
    });

    it("multiple set* fields apply together", () => {
      const result = applyEffect(INITIAL_DIALOGUE_STATE, {
        setFamilyId: "1nt",
        setCaptain: CaptainRole.Responder,
        setSystemMode: SystemMode.On,
        mergeConventionData: { openerSeat: Seat.North },
      });
      expect(result.familyId).toBe("1nt");
      expect(result.captain).toBe(CaptainRole.Responder);
      expect(result.systemMode).toBe(SystemMode.On);
      expect(result.conventionData["openerSeat"]).toBe(Seat.North);
    });
  });

  describe("entryIndex causality contract (Gap 2)", () => {
    it("passes entryIndex to transition rule matches()", () => {
      const indicesSeen: number[] = [];
      const spyRule: TransitionRule = {
        id: "spy-rule",
        matches(_state, _entry, _auction, entryIndex) {
          indicesSeen.push(entryIndex);
          return false; // never match — let baseline handle it
        },
        effects() {
          return {};
        },
      };

      const auction = buildAuction(Seat.North, ["1NT", "P", "2C"]);
      computeDialogueState(auction, [spyRule, ...baselineTransitionRules]);

      expect(indicesSeen).toEqual([0, 1, 2]);
    });

    it("passes entryIndex to transition rule effects()", () => {
      const effectIndices: number[] = [];
      const spyRule: TransitionRule = {
        id: "spy-effect-rule",
        matches() {
          return true; // always match
        },
        effects(_state, _entry, _auction, entryIndex) {
          effectIndices.push(entryIndex);
          return {};
        },
      };

      const auction = buildAuction(Seat.North, ["1NT", "P"]);
      computeDialogueState(auction, [spyRule]);

      expect(effectIndices).toEqual([0, 1]);
    });

    it("existing baseline + stayman rules produce same output with entryIndex", () => {
      // Regression: adding entryIndex doesn't change existing behavior
      const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2H"]);
      const state = computeStaymanState(auction);

      expect(state.familyId).toBe("1nt");
      expect(state.pendingAction).toBe(PendingAction.None);
      expect(state.agreedStrain).toEqual({
        type: "suit",
        suit: "H",
        confidence: "tentative",
      });
    });
  });

  // ─── Characterization tests: lock behavior before two-pass refactor ───

  describe("characterization: Stayman interference (flat array)", () => {
    it("1NT-(X) with Stayman rules: competitionMode=Doubled, stayman capability Modified", () => {
      const auction = buildAuction(Seat.North, ["1NT", "X"]);
      const state = computeStaymanState(auction);

      expect(state.familyId).toBe("1nt");
      expect(state.competitionMode).toBe(CompetitionMode.Doubled);
      expect(state.systemMode).toBe(SystemMode.Off);
      expect(getSystemModeFor(state, STAYMAN_CAPABILITY)).toBe(SystemMode.Modified);
      expect(state.interferenceDetail).toBeDefined();
      expect(state.interferenceDetail!.call).toEqual({ type: "double" });
      expect(state.interferenceDetail!.seat).toBe(Seat.East);
    });

    it("1NT-(2H) with Stayman rules: competitionMode=Overcalled, systemMode=Off", () => {
      const auction = buildAuction(Seat.North, ["1NT", "2H"]);
      const state = computeStaymanState(auction);

      expect(state.familyId).toBe("1nt");
      expect(state.competitionMode).toBe(CompetitionMode.Overcalled);
      expect(state.systemMode).toBe(SystemMode.Off);
      expect(state.interferenceDetail).toBeDefined();
      expect(state.interferenceDetail!.call).toEqual({ type: "bid", level: 2, strain: "H" });
    });
  });

  describe("characterization: Bergen interference (flat array)", () => {
    it("1H opening sets familyId=bergen and openerMajor", () => {
      const auction = buildAuction(Seat.North, ["1H"]);
      const state = computeDialogueState(auction, bergenRules);

      expect(state.familyId).toBe("bergen");
      expect(state.conventionData["openerMajor"]).toBe("H");
    });

    it("1H-(X) with Bergen rules: competitionMode=Doubled (openerSeat tracked)", () => {
      // Bergen transition rules now set openerSeat, so baseline
      // opponent-double correctly detects opponent and fires.
      const auction = buildAuction(Seat.North, ["1H", "X"]);
      const state = computeDialogueState(auction, bergenTransitionRules, baselineTransitionRules);

      expect(state.familyId).toBe("bergen");
      expect(state.competitionMode).toBe(CompetitionMode.Doubled);
      expect(state.interferenceDetail).toBeDefined();
    });
  });

  describe("characterization: Weak Twos interference (flat array)", () => {
    it("2H opening sets familyId=weak-two and openingSuit", () => {
      const auction = buildAuction(Seat.North, ["2H"]);
      const state = computeDialogueState(auction, weakTwoRules);

      expect(state.familyId).toBe("weak-two");
      expect(state.conventionData["openingSuit"]).toBe("H");
    });

    it("2H-(X) with Weak Two rules: competitionMode=Doubled (openerSeat tracked)", () => {
      const auction = buildAuction(Seat.North, ["2H", "X"]);
      const state = computeDialogueState(auction, weakTwoTransitionRules, baselineTransitionRules);

      expect(state.familyId).toBe("weak-two");
      expect(state.competitionMode).toBe(CompetitionMode.Doubled);
      expect(state.interferenceDetail).toBeDefined();
    });
  });

  // ─── Two-pass behavior tests (Step 1) ─────────────────────────────

  describe("two-pass: convention + baseline backfill", () => {
    it("convention sets capability, baseline backfills systemMode + competitionMode + interferenceDetail", () => {
      // Simulates Stayman 1nt-doubled: convention sets stayman capability=Modified,
      // baseline backfills systemMode=Off, competitionMode=Doubled, and interferenceDetail.
      const conventionRules: TransitionRule[] = [
        {
          id: "test-convention-capability-only",
          matches(state, entry) {
            const { call } = entry;
            return state.familyId === "1nt" && call.type === "double";
          },
          effects() {
            return { setSystemCapability: { [STAYMAN_CAPABILITY]: SystemMode.Modified } };
          },
        },
      ];

      const auction = buildAuction(Seat.North, ["1NT", "X"]);
      const state = computeDialogueState(auction, conventionRules, baselineTransitionRules);

      expect(state.familyId).toBe("1nt");
      // Baseline backfills systemMode=Off (convention didn't set it)
      expect(state.systemMode).toBe(SystemMode.Off);
      // Convention set stayman capability
      expect(getSystemModeFor(state, STAYMAN_CAPABILITY)).toBe(SystemMode.Modified);
      // Baseline backfills competitionMode
      expect(state.competitionMode).toBe(CompetitionMode.Doubled);
      // Baseline backfills interferenceDetail
      expect(state.interferenceDetail).toBeDefined();
    });

    it("no convention match → baseline has full authority", () => {
      const conventionRules: TransitionRule[] = [
        {
          id: "test-never-match",
          matches() { return false; },
          effects() { return {}; },
        },
      ];

      const auction = buildAuction(Seat.North, ["1NT", "X"]);
      const state = computeDialogueState(auction, conventionRules, baselineTransitionRules);

      // Baseline handles everything
      expect(state.familyId).toBe("1nt");
      expect(state.competitionMode).toBe(CompetitionMode.Doubled);
      expect(state.systemMode).toBe(SystemMode.Off);
    });

    it("convention returns empty effect → baseline backfills all fields", () => {
      const conventionRules: TransitionRule[] = [
        {
          id: "test-empty-effect",
          matches(state, entry) {
            const { call } = entry;
            return state.familyId === "1nt" && call.type === "double";
          },
          effects() { return {}; },
        },
      ];

      const auction = buildAuction(Seat.North, ["1NT", "X"]);
      const state = computeDialogueState(auction, conventionRules, baselineTransitionRules);

      // Empty convention effect → baseline backfills everything
      expect(state.competitionMode).toBe(CompetitionMode.Doubled);
      expect(state.systemMode).toBe(SystemMode.Off);
      expect(state.interferenceDetail).toBeDefined();
    });

    it("mergeConventionData from both passes: convention keys win, unique keys merge", () => {
      // Both convention and baseline rules match the SAME entry (a double after 1NT).
      // Convention sets conventionData.tag="conv-tag"; baseline sets tag="base-tag" + detail="base-detail".
      // Convention's "tag" should win; baseline's "detail" should be backfilled.
      const conventionRules: TransitionRule[] = [
        {
          id: "test-conv-data-double",
          matches(state, entry) {
            const { call } = entry;
            return state.familyId === "1nt" && call.type === "double";
          },
          effects() {
            return {
              setSystemCapability: { [STAYMAN_CAPABILITY]: SystemMode.Modified },
              mergeConventionData: { tag: "conv-tag" },
            };
          },
        },
      ];
      const testBaseline: TransitionRule[] = [
        ...baselineTransitionRules.map(r =>
          r.id === "opponent-double"
            ? {
                ...r,
                effects(...args: Parameters<TransitionRule["effects"]>) {
                  const base = r.effects(...args);
                  return { ...base, mergeConventionData: { tag: "base-tag", detail: "base-detail" } };
                },
              }
            : r,
        ),
      ];

      const auction = buildAuction(Seat.North, ["1NT", "X"]);
      const state = computeDialogueState(auction, conventionRules, testBaseline);

      // Convention key "tag" wins
      expect(state.conventionData["tag"]).toBe("conv-tag");
      // Baseline key "detail" backfilled
      expect(state.conventionData["detail"]).toBe("base-detail");
    });

    it("2-arg signature is backward compatible (single-pass)", () => {
      const auction = buildAuction(Seat.North, ["1NT", "X"]);
      const state = computeDialogueState(auction, baselineTransitionRules);

      // Baseline-only 2-arg call: double sets competitionMode + systemMode=Off
      expect(state.familyId).toBe("1nt");
      expect(state.competitionMode).toBe(CompetitionMode.Doubled);
      expect(state.systemMode).toBe(SystemMode.Off);
    });
  });

  describe("characterization: SAYC interference (flat array)", () => {
    it("1NT opening sets familyId=sayc-1nt", () => {
      const auction = buildAuction(Seat.North, ["1NT"]);
      const state = computeDialogueState(auction, saycRules);

      expect(state.familyId).toBe("sayc-1nt");
    });

    it("1NT-(X) with SAYC rules: competitionMode stays Uncontested (openerSeat not tracked)", () => {
      // SAYC 1NT rule sets familyId but not openerSeat, so baseline
      // opponent-double can't determine partnership → doesn't fire.
      const auction = buildAuction(Seat.North, ["1NT", "X"]);
      const state = computeDialogueState(auction, saycRules);

      expect(state.familyId).toBe("sayc-1nt");
      expect(state.competitionMode).toBe(CompetitionMode.Uncontested);
      expect(state.interferenceDetail).toBeUndefined();
    });
  });

  // ─── Phase 8a: Transition rule actor-awareness ─────────────

  describe("actor-aware transitions: Stayman", () => {
    it("1NT-(2C): opponent 2C does NOT trigger Stayman ask effects", () => {
      // North opens 1NT, East bids 2C (natural overcall) — should NOT trigger Stayman
      const auction = buildAuction(Seat.North, ["1NT", "2C"]);
      const state = computeStaymanState(auction);

      // Opponent's 2C should NOT set ShowMajor or ForcingOneRound
      expect(state.pendingAction).not.toBe(PendingAction.ShowMajor);
      expect(state.forcingState).not.toBe(ForcingState.ForcingOneRound);
    });

    it("1NT-P-2C-(2H): opponent 2H does NOT trigger Stayman response", () => {
      // North opens 1NT, East passes, South bids 2C (Stayman), West bids 2H
      const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "2H"]);
      const state = computeStaymanState(auction);

      // Partner's 2C DID set Stayman ask
      expect(state.pendingAction).toBe(PendingAction.ShowMajor);
      // Opponent's 2H should NOT resolve the Stayman response
      expect(state.agreedStrain).not.toEqual({
        type: "suit",
        suit: "H",
        confidence: "tentative",
      });
    });

    it("1NT-P-2C: partner 2C DOES trigger Stayman ask", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P", "2C"]);
      const state = computeStaymanState(auction);

      expect(state.pendingAction).toBe(PendingAction.ShowMajor);
      expect(state.forcingState).toBe(ForcingState.ForcingOneRound);
    });

    it("1NT-P-2C-P-2H: opener 2H DOES trigger Stayman response", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2H"]);
      const state = computeStaymanState(auction);

      expect(state.pendingAction).toBe(PendingAction.None);
      expect(state.agreedStrain).toEqual({
        type: "suit",
        suit: "H",
        confidence: "tentative",
      });
    });
  });

  describe("actor-aware transitions: Bergen", () => {
    it("1H-(3C): opponent raise does NOT trigger Bergen constructive response", () => {
      // North opens 1H, East bids 3C (natural) — should NOT trigger Bergen constructive
      const auction = buildAuction(Seat.North, ["1H", "3C"]);
      const state = computeDialogueState(auction, bergenTransitionRules, baselineTransitionRules);

      // Opponent's 3C should NOT set responseType
      expect(state.conventionData["responseType"]).toBeUndefined();
    });

    it("1H-P-3C: partner raise DOES trigger Bergen constructive response", () => {
      const auction = buildAuction(Seat.North, ["1H", "P", "3C"]);
      const state = computeDialogueState(auction, bergenTransitionRules, baselineTransitionRules);

      expect(state.conventionData["responseType"]).toBe("constructive");
    });
  });

  describe("actor-aware transitions: Weak Twos", () => {
    it("2H-(2NT): opponent bid does NOT trigger Ogust ask", () => {
      // North opens 2H, East bids 2NT (natural) — should NOT trigger Ogust
      const auction = buildAuction(Seat.North, ["2H", "2NT"]);
      const state = computeDialogueState(auction, weakTwoTransitionRules, baselineTransitionRules);

      expect(state.pendingAction).not.toBe(PendingAction.ShowSuit);
    });

    it("2H-P-2NT: partner bid DOES trigger Ogust ask", () => {
      const auction = buildAuction(Seat.North, ["2H", "P", "2NT"]);
      const state = computeDialogueState(auction, weakTwoTransitionRules, baselineTransitionRules);

      expect(state.pendingAction).toBe(PendingAction.ShowSuit);
    });
  });

  describe("getSystemModeFor", () => {
    it("returns systemMode when no capabilities set", () => {
      const state: import("../../core/dialogue/dialogue-state").DialogueState = {
        ...INITIAL_DIALOGUE_STATE,
        systemMode: SystemMode.On,
      };
      expect(getSystemModeFor(state, "stayman")).toBe(SystemMode.On);
    });

    it("returns capability-specific mode when set", () => {
      const state: import("../../core/dialogue/dialogue-state").DialogueState = {
        ...INITIAL_DIALOGUE_STATE,
        systemMode: SystemMode.Off,
        systemCapabilities: { stayman: SystemMode.Modified },
      };
      expect(getSystemModeFor(state, "stayman")).toBe(SystemMode.Modified);
    });

    it("falls back to systemMode for unset capabilities", () => {
      const state: import("../../core/dialogue/dialogue-state").DialogueState = {
        ...INITIAL_DIALOGUE_STATE,
        systemMode: SystemMode.Off,
        systemCapabilities: { stayman: SystemMode.Modified },
      };
      expect(getSystemModeFor(state, "transfers")).toBe(SystemMode.Off);
    });
  });

  describe("systemCapabilities in applyEffect", () => {
    it("setSystemCapability merges into existing capabilities", () => {
      const state1 = applyEffect(INITIAL_DIALOGUE_STATE, {
        setSystemCapability: { stayman: SystemMode.Modified },
      });
      const state2 = applyEffect(state1, {
        setSystemCapability: { transfers: SystemMode.On },
      });
      expect(state2.systemCapabilities).toEqual({
        stayman: SystemMode.Modified,
        transfers: SystemMode.On,
      });
    });

    it("setSystemCapability does not affect systemMode", () => {
      const result = applyEffect(INITIAL_DIALOGUE_STATE, {
        setSystemCapability: { stayman: SystemMode.Modified },
      });
      expect(result.systemMode).toBe(SystemMode.Off);
      expect(result.systemCapabilities).toEqual({ stayman: SystemMode.Modified });
    });
  });

  describe("systemCapabilities in applyBackfillEffect", () => {
    it("backfill applies setSystemCapability when convention did not set any", () => {
      // applyBackfillEffect imported at top of file
      const result = applyBackfillEffect(
        INITIAL_DIALOGUE_STATE,
        { setSystemCapability: { stayman: SystemMode.Off } },
        new Set<string>(),
      );
      expect(result.systemCapabilities).toEqual({ stayman: SystemMode.Off });
    });

    it("per-key merge: convention stayman=Modified survives baseline stayman=Off backfill", () => {
      // applyBackfillEffect imported at top of file
      const stateWithConvCapability: import("../../core/dialogue/dialogue-state").DialogueState = {
        ...INITIAL_DIALOGUE_STATE,
        systemCapabilities: { stayman: SystemMode.Modified },
      };
      const result = applyBackfillEffect(
        stateWithConvCapability,
        { setSystemCapability: { stayman: SystemMode.Off } },
        new Set(["setSystemCapability"]),
      );
      expect(result.systemCapabilities!["stayman"]).toBe(SystemMode.Modified);
    });

    it("per-key merge: convention stayman=Modified, baseline transfers=Off — both survive", () => {
      // applyBackfillEffect imported at top of file
      const stateWithConvCapability: import("../../core/dialogue/dialogue-state").DialogueState = {
        ...INITIAL_DIALOGUE_STATE,
        systemCapabilities: { stayman: SystemMode.Modified },
      };
      const result = applyBackfillEffect(
        stateWithConvCapability,
        { setSystemCapability: { transfers: SystemMode.Off } },
        new Set(["setSystemCapability"]),
      );
      expect(result.systemCapabilities!["stayman"]).toBe(SystemMode.Modified);
      expect(result.systemCapabilities!["transfers"]).toBe(SystemMode.Off);
    });
  });

  describe("dialogue frame stack", () => {
    it("initial state exposes empty frames array", () => {
      const auction = buildAuction(Seat.North, []);
      const state = computeStaymanState(auction);

      expect(state.frames).toEqual([]);
    });

    it("applyEffect supports pushFrame", () => {
      const result = applyEffect(INITIAL_DIALOGUE_STATE, {
        pushFrame: {
          kind: "relay",
          owner: "opener",
          targetStrain: BidSuit.Clubs,
          targetLevel: 3,
          pushedAt: 0,
        },
      });

      expect(result.frames).toHaveLength(1);
      expect(result.frames![0]).toEqual({
        kind: "relay",
        owner: "opener",
        targetStrain: BidSuit.Clubs,
        targetLevel: 3,
        pushedAt: 0,
      });
    });

    it("applyEffect supports popFrame", () => {
      const pushed = applyEffect(INITIAL_DIALOGUE_STATE, {
        pushFrame: {
          kind: "relay",
          owner: "opener",
          targetStrain: BidSuit.Clubs,
          targetLevel: 3,
          pushedAt: 0,
        },
      });
      const popped = applyEffect(pushed, { popFrame: true });

      expect(popped.frames).toEqual([]);
    });

    it("applyEffect handles atomic pop-then-push in one effect", () => {
      const seeded = applyEffect(INITIAL_DIALOGUE_STATE, {
        pushFrame: {
          kind: "relay",
          owner: "opener",
          targetStrain: BidSuit.Clubs,
          targetLevel: 3,
          pushedAt: 2,
        },
      });

      const swapped = applyEffect(seeded, {
        popFrame: true,
        pushFrame: {
          kind: "place-contract",
          owner: "responder",
          pushedAt: 4,
        },
      });

      expect(swapped.frames).toEqual([
        {
          kind: "place-contract",
          owner: "responder",
          pushedAt: 4,
        },
      ]);
    });

    it("applyEffect popFrame is a no-op on empty stack", () => {
      const popped = applyEffect(INITIAL_DIALOGUE_STATE, { popFrame: true });
      expect(popped.frames).toEqual([]);
    });

    it("computeDialogueState preserves behavior when pushing then popping frames", () => {
      const frameRules: TransitionRule[] = [
        {
          id: "push-on-opening",
          matches(_state, _entry, _auction, entryIndex) {
            return entryIndex === 0;
          },
          effects() {
            return {
              setFamilyId: "1nt",
              pushFrame: {
                kind: "relay",
                owner: "opener",
                targetStrain: BidSuit.Clubs,
                targetLevel: 3,
                pushedAt: 0,
              },
            };
          },
        },
        {
          id: "pop-on-pass",
          matches(_state, _entry, _auction, entryIndex) {
            return entryIndex === 1;
          },
          effects() {
            return { popFrame: true };
          },
        },
      ];

      const auction = buildAuction(Seat.North, ["1NT", "P"]);
      const state = computeDialogueState(auction, frameRules);

      expect(state.familyId).toBe("1nt");
      expect(state.frames).toEqual([]);
    });

    it("cross-convention isolation: non-Lebensohl conventions keep frame stack empty", () => {
      const staymanState = computeStaymanState(buildAuction(Seat.North, ["1NT", "P", "2C"]));
      const bergenState = computeDialogueState(
        buildAuction(Seat.North, ["1H", "P", "3C"]),
        bergenRules,
      );
      const weakTwosState = computeDialogueState(
        buildAuction(Seat.North, ["2H", "P", "2NT"]),
        weakTwoRules,
      );
      const saycState = computeDialogueState(
        buildAuction(Seat.North, ["1NT"]),
        saycRules,
      );
      const lebensohlNoFrameState = computeDialogueState(
        buildAuction(Seat.North, ["1NT", "2H", "3H"]),
        lebensohlRules,
      );

      expect(staymanState.frames).toEqual([]);
      expect(bergenState.frames).toEqual([]);
      expect(weakTwosState.frames).toEqual([]);
      expect(saycState.frames).toEqual([]);
      expect(lebensohlNoFrameState.frames).toEqual([]);
    });
  });
});
