import { describe, it, expect } from "vitest";
import { createSystemFactCatalog } from "../system-fact-catalog";
import { SAYC_SYSTEM_CONFIG } from "../../../../core/contracts/system-config";
import type { SystemConfig } from "../../../../core/contracts/system-config";
import {
  SYSTEM_RESPONDER_WEAK_HAND,
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
  SYSTEM_RESPONDER_SLAM_VALUES,
  SYSTEM_OPENER_NOT_MINIMUM,
  SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT,
  SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING,
  SYSTEM_ONE_NT_FORCING_AFTER_MAJOR,
  SYSTEM_RESPONDER_ONE_NT_RANGE,
  SYSTEM_FACT_IDS,
} from "../../../../core/contracts/system-fact-vocabulary";
import { TWO_OVER_ONE_SYSTEM_CONFIG } from "../../../../core/contracts/system-config";
import type { FactValue } from "../../../../core/contracts/fact-catalog";
import { FactLayer } from "../../../../core/contracts/fact-layer";

function hcpMap(hcp: number): ReadonlyMap<string, FactValue> {
  return new Map([["hand.hcp", { factId: "hand.hcp", value: hcp }]]);
}

describe("createSystemFactCatalog", () => {
  const catalog = createSystemFactCatalog(SAYC_SYSTEM_CONFIG);

  describe("structure", () => {
    it("returns 9 definitions", () => {
      expect(catalog.definitions).toHaveLength(9);
    });

    it("includes all system fact IDs in definitions", () => {
      const ids = catalog.definitions.map((d) => d.id);
      for (const factId of SYSTEM_FACT_IDS) {
        expect(ids).toContain(factId);
      }
    });

    it("includes evaluators for all system fact IDs", () => {
      for (const factId of SYSTEM_FACT_IDS) {
        expect(catalog.evaluators.has(factId)).toBe(true);
      }
    });

    it('all definitions have layer FactLayer.SystemDerived and world "acting-hand"', () => {
      for (const def of catalog.definitions) {
        expect(def.layer).toBe(FactLayer.SystemDerived);
        expect(def.world).toBe("acting-hand");
      }
    });
  });

  describe("evaluator behavior (SAYC thresholds)", () => {
    const ev = catalog.evaluators;

    function call(factId: string, hcp: number): FactValue {
      return ev.get(factId)!(undefined as any, undefined as any, hcpMap(hcp));
    }

    it("weakHand: true for HCP < 8, false at 8", () => {
      expect(call(SYSTEM_RESPONDER_WEAK_HAND, 7).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_WEAK_HAND, 8).value).toBe(false);
    });

    it("inviteValues: true for 8-9, false outside", () => {
      expect(call(SYSTEM_RESPONDER_INVITE_VALUES, 8).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_INVITE_VALUES, 9).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_INVITE_VALUES, 7).value).toBe(false);
      expect(call(SYSTEM_RESPONDER_INVITE_VALUES, 10).value).toBe(false);
    });

    it("gameValues: true for HCP >= 10, false below", () => {
      expect(call(SYSTEM_RESPONDER_GAME_VALUES, 10).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_GAME_VALUES, 9).value).toBe(false);
    });

    it("slamValues: true for HCP >= 15, false below", () => {
      expect(call(SYSTEM_RESPONDER_SLAM_VALUES, 15).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_SLAM_VALUES, 14).value).toBe(false);
    });

    it("openerNotMinimum: true for HCP >= 16, false below", () => {
      expect(call(SYSTEM_OPENER_NOT_MINIMUM, 16).value).toBe(true);
      expect(call(SYSTEM_OPENER_NOT_MINIMUM, 15).value).toBe(false);
    });

    it("twoLevelNewSuit: SAYC true at 10, false at 9", () => {
      expect(call(SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT, 10).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT, 9).value).toBe(false);
    });

    it("isGameForcing: false for SAYC", () => {
      expect(call(SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING, 0).value).toBe(false);
    });

    it("oneNtForcingAfterMajor: 'non-forcing' for SAYC", () => {
      expect(call(SYSTEM_ONE_NT_FORCING_AFTER_MAJOR, 0).value).toBe("non-forcing");
    });

    it("oneNtRange: SAYC true for 6-10, false at 5 and 11", () => {
      expect(call(SYSTEM_RESPONDER_ONE_NT_RANGE, 6).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_ONE_NT_RANGE, 10).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_ONE_NT_RANGE, 5).value).toBe(false);
      expect(call(SYSTEM_RESPONDER_ONE_NT_RANGE, 11).value).toBe(false);
    });
  });

  describe("evaluator behavior (2/1 thresholds)", () => {
    const twoOverOneCatalog = createSystemFactCatalog(TWO_OVER_ONE_SYSTEM_CONFIG);
    const ev = twoOverOneCatalog.evaluators;

    function call(factId: string, hcp: number): FactValue {
      return ev.get(factId)!(undefined as any, undefined as any, hcpMap(hcp));
    }

    it("twoLevelNewSuit: 2/1 true at 12, false at 11", () => {
      expect(call(SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT, 12).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT, 11).value).toBe(false);
    });

    it("isGameForcing: true for 2/1", () => {
      expect(call(SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING, 0).value).toBe(true);
    });

    it("oneNtForcingAfterMajor: 'semi-forcing' for 2/1", () => {
      expect(call(SYSTEM_ONE_NT_FORCING_AFTER_MAJOR, 0).value).toBe("semi-forcing");
    });

    it("oneNtRange: 2/1 true for 6-12, false at 13", () => {
      expect(call(SYSTEM_RESPONDER_ONE_NT_RANGE, 6).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_ONE_NT_RANGE, 12).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_ONE_NT_RANGE, 13).value).toBe(false);
    });
  });

  describe("custom system config", () => {
    const custom: SystemConfig = {
      ...SAYC_SYSTEM_CONFIG,
      responderThresholds: { inviteMin: 10, inviteMax: 11, gameMin: 13, slamMin: 17 },
      openerRebid: { notMinimum: 18 },
      suitResponse: { twoLevelMin: 11, twoLevelForcingDuration: "one-round" },
      oneNtResponseAfterMajor: { forcing: "forcing", maxHcp: 11 },
    };
    const customCatalog = createSystemFactCatalog(custom);
    const ev = customCatalog.evaluators;

    function call(factId: string, hcp: number): FactValue {
      return ev.get(factId)!(undefined as any, undefined as any, hcpMap(hcp));
    }

    it("weakHand uses custom inviteMin threshold", () => {
      expect(call(SYSTEM_RESPONDER_WEAK_HAND, 9).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_WEAK_HAND, 10).value).toBe(false);
    });

    it("inviteValues uses custom invite range", () => {
      expect(call(SYSTEM_RESPONDER_INVITE_VALUES, 10).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_INVITE_VALUES, 11).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_INVITE_VALUES, 9).value).toBe(false);
      expect(call(SYSTEM_RESPONDER_INVITE_VALUES, 12).value).toBe(false);
    });

    it("gameValues uses custom gameMin", () => {
      expect(call(SYSTEM_RESPONDER_GAME_VALUES, 13).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_GAME_VALUES, 12).value).toBe(false);
    });

    it("slamValues uses custom slamMin", () => {
      expect(call(SYSTEM_RESPONDER_SLAM_VALUES, 17).value).toBe(true);
      expect(call(SYSTEM_RESPONDER_SLAM_VALUES, 16).value).toBe(false);
    });

    it("openerNotMinimum uses custom notMinimum", () => {
      expect(call(SYSTEM_OPENER_NOT_MINIMUM, 18).value).toBe(true);
      expect(call(SYSTEM_OPENER_NOT_MINIMUM, 17).value).toBe(false);
    });
  });
});
