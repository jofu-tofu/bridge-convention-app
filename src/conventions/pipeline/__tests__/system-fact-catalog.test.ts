import { describe, it, expect } from "vitest";
import { ConfidenceLevel } from "../../core/committed-step";
import { createSystemFactCatalog, computeTrumpTotalPoints, detectTrumpSuit } from "../facts/system-fact-catalog";
import { SAYC_SYSTEM_CONFIG, ACOL_SYSTEM_CONFIG } from "../../definitions/system-config";
import type { SystemConfig } from "../../definitions/system-config";
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
} from "../../definitions/system-fact-vocabulary";
import { TWO_OVER_ONE_SYSTEM_CONFIG } from "../../definitions/system-config";
import type { FactValue } from "../../core/fact-catalog";
import { EvaluationWorld } from "../../core/fact-catalog";
import { FactLayer } from "../../core/fact-layer";
import { ObsSuit } from "../bid-action";

function hcpMap(hcp: number): ReadonlyMap<string, FactValue> {
  return new Map([["hand.hcp", { factId: "hand.hcp", value: hcp }]]);
}

/** Build a fact map with HCP + suit lengths for trump TP testing. */
function handMap(hcp: number, shape: [number, number, number, number]): ReadonlyMap<string, FactValue> {
  return new Map<string, FactValue>([
    ["hand.hcp", { factId: "hand.hcp", value: hcp }],
    ["hand.suitLength.spades", { factId: "hand.suitLength.spades", value: shape[0] }],
    ["hand.suitLength.hearts", { factId: "hand.suitLength.hearts", value: shape[1] }],
    ["hand.suitLength.diamonds", { factId: "hand.suitLength.diamonds", value: shape[2] }],
    ["hand.suitLength.clubs", { factId: "hand.suitLength.clubs", value: shape[3] }],
  ]);
}

describe("createSystemFactCatalog", () => {
  const catalog = createSystemFactCatalog(SAYC_SYSTEM_CONFIG);

  describe("structure", () => {
    it("returns 10 definitions", () => {
      expect(catalog.definitions).toHaveLength(10);
    });

    it("includes all system fact IDs in definitions", () => {
      const ids = catalog.definitions.map((d) => d.id);
      for (const factId of SYSTEM_FACT_IDS) {
        expect(ids).toContain(factId);
      }
    });

    it("includes standard evaluators for all system fact IDs", () => {
      for (const factId of SYSTEM_FACT_IDS) {
        expect(catalog.evaluators.has(factId)).toBe(true);
      }
    });

    it('all definitions have layer FactLayer.SystemDerived and world "acting-hand"', () => {
      for (const def of catalog.definitions) {
        expect(def.layer).toBe(FactLayer.SystemDerived);
        expect(def.world).toBe(EvaluationWorld.ActingHand);
      }
    });

    it("6 hand-dependent facts are relational evaluators", () => {
      const relational = catalog.relationalEvaluators!;
      expect(relational.has(SYSTEM_RESPONDER_WEAK_HAND)).toBe(true);
      expect(relational.has(SYSTEM_RESPONDER_INVITE_VALUES)).toBe(true);
      expect(relational.has(SYSTEM_RESPONDER_GAME_VALUES)).toBe(true);
      expect(relational.has(SYSTEM_RESPONDER_SLAM_VALUES)).toBe(true);
      expect(relational.has(SYSTEM_OPENER_NOT_MINIMUM)).toBe(true);
      expect(relational.has(SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT)).toBe(true);
    });
  });

  describe("evaluator behavior (SAYC thresholds, no fitAgreed — HCP fallback)", () => {
    const relEv = catalog.relationalEvaluators!;
    const ev = catalog.evaluators;
    const noFitCtx = {};

    function callRel(factId: string, hcp: number): FactValue {
      // any: test-only — hand/evaluation not used by system evaluators
      return relEv.get(factId)!(undefined as any, undefined as any, hcpMap(hcp), noFitCtx);
    }

    function callStd(factId: string, hcp: number): FactValue {
      // any: test-only
      return ev.get(factId)!(undefined as any, undefined as any, hcpMap(hcp));
    }

    it("weakHand: true for HCP < 8, false at 8", () => {
      expect(callRel(SYSTEM_RESPONDER_WEAK_HAND, 7).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_WEAK_HAND, 8).value).toBe(false);
    });

    it("inviteValues: true for 8-9, false outside", () => {
      expect(callRel(SYSTEM_RESPONDER_INVITE_VALUES, 8).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_INVITE_VALUES, 9).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_INVITE_VALUES, 7).value).toBe(false);
      expect(callRel(SYSTEM_RESPONDER_INVITE_VALUES, 10).value).toBe(false);
    });

    it("gameValues: true for HCP >= 10, false below", () => {
      expect(callRel(SYSTEM_RESPONDER_GAME_VALUES, 10).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_GAME_VALUES, 9).value).toBe(false);
    });

    it("slamValues: true for HCP >= 15, false below", () => {
      expect(callRel(SYSTEM_RESPONDER_SLAM_VALUES, 15).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_SLAM_VALUES, 14).value).toBe(false);
    });

    it("openerNotMinimum: true for HCP >= 16, false below", () => {
      expect(callRel(SYSTEM_OPENER_NOT_MINIMUM, 16).value).toBe(true);
      expect(callRel(SYSTEM_OPENER_NOT_MINIMUM, 15).value).toBe(false);
    });

    it("twoLevelNewSuit: SAYC true at 10, false at 9", () => {
      expect(callRel(SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT, 10).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT, 9).value).toBe(false);
    });

    it("isGameForcing: false for SAYC", () => {
      expect(callStd(SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING, 0).value).toBe(false);
    });

    it("oneNtForcingAfterMajor: 'non-forcing' for SAYC", () => {
      expect(callStd(SYSTEM_ONE_NT_FORCING_AFTER_MAJOR, 0).value).toBe("non-forcing");
    });

    it("oneNtRange: SAYC true for 6-10, false at 5 and 11", () => {
      expect(callStd(SYSTEM_RESPONDER_ONE_NT_RANGE, 6).value).toBe(true);
      expect(callStd(SYSTEM_RESPONDER_ONE_NT_RANGE, 10).value).toBe(true);
      expect(callStd(SYSTEM_RESPONDER_ONE_NT_RANGE, 5).value).toBe(false);
      expect(callStd(SYSTEM_RESPONDER_ONE_NT_RANGE, 11).value).toBe(false);
    });
  });

  describe("evaluator behavior (2/1 thresholds)", () => {
    const twoOverOneCatalog = createSystemFactCatalog(TWO_OVER_ONE_SYSTEM_CONFIG);
    const ev = twoOverOneCatalog.evaluators;
    const relEv = twoOverOneCatalog.relationalEvaluators!;
    const noFitCtx = {};

    function callStd(factId: string, hcp: number): FactValue {
      return ev.get(factId)!(undefined as any, undefined as any, hcpMap(hcp));
    }

    function callRel(factId: string, hcp: number): FactValue {
      return relEv.get(factId)!(undefined as any, undefined as any, hcpMap(hcp), noFitCtx);
    }

    it("twoLevelNewSuit: 2/1 true at 12, false at 11", () => {
      expect(callRel(SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT, 12).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT, 11).value).toBe(false);
    });

    it("isGameForcing: true for 2/1", () => {
      expect(callStd(SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING, 0).value).toBe(true);
    });

    it("oneNtForcingAfterMajor: 'semi-forcing' for 2/1", () => {
      expect(callStd(SYSTEM_ONE_NT_FORCING_AFTER_MAJOR, 0).value).toBe("semi-forcing");
    });

    it("oneNtRange: 2/1 true for 6-12, false at 13", () => {
      expect(callStd(SYSTEM_RESPONDER_ONE_NT_RANGE, 6).value).toBe(true);
      expect(callStd(SYSTEM_RESPONDER_ONE_NT_RANGE, 12).value).toBe(true);
      expect(callStd(SYSTEM_RESPONDER_ONE_NT_RANGE, 13).value).toBe(false);
    });
  });

  describe("custom system config", () => {
    const custom: SystemConfig = {
      ...SAYC_SYSTEM_CONFIG,
      responderThresholds: {
        inviteMin: 10, inviteMax: 11, gameMin: 13, slamMin: 17,
        inviteMinTp: { trump: 10, nt: 10 }, inviteMaxTp: { trump: 12, nt: 11 },
        gameMinTp: { trump: 13, nt: 13 }, slamMinTp: { trump: 18, nt: 17 },
      },
      openerRebid: { notMinimum: 18, notMinimumTp: { trump: 18, nt: 18 } },
      suitResponse: { twoLevelMin: 11, twoLevelForcingDuration: "one-round" },
      oneNtResponseAfterMajor: { forcing: "forcing", maxHcp: 11, minHcp: 6 },
    };
    const customCatalog = createSystemFactCatalog(custom);
    const relEv = customCatalog.relationalEvaluators!;
    const noFitCtx = {};

    function callRel(factId: string, hcp: number): FactValue {
      return relEv.get(factId)!(undefined as any, undefined as any, hcpMap(hcp), noFitCtx);
    }

    it("weakHand uses custom inviteMin threshold", () => {
      expect(callRel(SYSTEM_RESPONDER_WEAK_HAND, 9).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_WEAK_HAND, 10).value).toBe(false);
    });

    it("inviteValues uses custom invite range", () => {
      expect(callRel(SYSTEM_RESPONDER_INVITE_VALUES, 10).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_INVITE_VALUES, 11).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_INVITE_VALUES, 9).value).toBe(false);
      expect(callRel(SYSTEM_RESPONDER_INVITE_VALUES, 12).value).toBe(false);
    });

    it("gameValues uses custom gameMin", () => {
      expect(callRel(SYSTEM_RESPONDER_GAME_VALUES, 13).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_GAME_VALUES, 12).value).toBe(false);
    });

    it("slamValues uses custom slamMin", () => {
      expect(callRel(SYSTEM_RESPONDER_SLAM_VALUES, 17).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_SLAM_VALUES, 16).value).toBe(false);
    });

    it("openerNotMinimum uses custom notMinimum", () => {
      expect(callRel(SYSTEM_OPENER_NOT_MINIMUM, 18).value).toBe(true);
      expect(callRel(SYSTEM_OPENER_NOT_MINIMUM, 17).value).toBe(false);
    });
  });

  describe("evaluator behavior (Acol thresholds)", () => {
    const acolCatalog = createSystemFactCatalog(ACOL_SYSTEM_CONFIG);
    const ev = acolCatalog.evaluators;
    const relEv = acolCatalog.relationalEvaluators!;
    const noFitCtx = {};

    function callRel(factId: string, hcp: number): FactValue {
      return relEv.get(factId)!(undefined as any, undefined as any, hcpMap(hcp), noFitCtx);
    }

    function callStd(factId: string, hcp: number): FactValue {
      return ev.get(factId)!(undefined as any, undefined as any, hcpMap(hcp));
    }

    it("weakHand: true for HCP < 10, false at 10 (Acol inviteMin)", () => {
      expect(callRel(SYSTEM_RESPONDER_WEAK_HAND, 9).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_WEAK_HAND, 10).value).toBe(false);
    });

    it("inviteValues: true for 10-12 (Acol invite range)", () => {
      expect(callRel(SYSTEM_RESPONDER_INVITE_VALUES, 10).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_INVITE_VALUES, 12).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_INVITE_VALUES, 9).value).toBe(false);
      expect(callRel(SYSTEM_RESPONDER_INVITE_VALUES, 13).value).toBe(false);
    });

    it("gameValues: true for HCP >= 13 (Acol game threshold)", () => {
      expect(callRel(SYSTEM_RESPONDER_GAME_VALUES, 13).value).toBe(true);
      expect(callRel(SYSTEM_RESPONDER_GAME_VALUES, 12).value).toBe(false);
    });

    it("oneNtRange: Acol true for 6-9, false at 5 and 10", () => {
      expect(callStd(SYSTEM_RESPONDER_ONE_NT_RANGE, 6).value).toBe(true);
      expect(callStd(SYSTEM_RESPONDER_ONE_NT_RANGE, 9).value).toBe(true);
      expect(callStd(SYSTEM_RESPONDER_ONE_NT_RANGE, 5).value).toBe(false);
      expect(callStd(SYSTEM_RESPONDER_ONE_NT_RANGE, 10).value).toBe(false);
    });
  });
});

// ─── Phase B: Context-aware system facts ────────────────────────

describe("computeTrumpTotalPoints", () => {
  it("hand with void in non-agreed suit → +3 shortage points", () => {
    // 9 HCP, shape [5,4,4,0], agreed suit = spades → void in clubs = +3
    const m = handMap(9, [5, 4, 4, 0]);
    expect(computeTrumpTotalPoints(m, "spades")).toBe(9 + 3);
  });

  it("hand with singleton in non-agreed suit → +2", () => {
    // 10 HCP, shape [5,4,3,1], agreed suit = spades → singleton clubs = +2
    const m = handMap(10, [5, 4, 3, 1]);
    expect(computeTrumpTotalPoints(m, "spades")).toBe(10 + 2);
  });

  it("hand with doubleton in non-agreed suit → +1", () => {
    // 10 HCP, shape [5,4,2,2], agreed suit = spades → doubleton in diamonds + clubs = +2
    const m = handMap(10, [5, 4, 2, 2]);
    expect(computeTrumpTotalPoints(m, "spades")).toBe(10 + 2);
  });

  it("shortage in agreed suit is NOT counted", () => {
    // 9 HCP, shape [5,4,4,0], agreed suit = clubs → void is in agreed suit = 0
    // Other suits: 5,4,4 → no shortage
    const m = handMap(9, [5, 4, 4, 0]);
    expect(computeTrumpTotalPoints(m, "clubs")).toBe(9);
  });
});

describe("detectTrumpSuit", () => {
  it("returns suit name for hearts fit", () => {
    expect(detectTrumpSuit({ fitAgreed: { strain: ObsSuit.Hearts } })).toBe("hearts");
  });

  it("returns undefined for notrump fit", () => {
    expect(detectTrumpSuit({ fitAgreed: { strain: "notrump" } })).toBeUndefined();
  });

  it("returns undefined for null fitAgreed", () => {
    expect(detectTrumpSuit({ fitAgreed: null })).toBeUndefined();
  });

  it("returns undefined when fitAgreed is absent", () => {
    expect(detectTrumpSuit({})).toBeUndefined();
  });
});

describe("context-aware relational evaluators (SAYC, with fitAgreed)", () => {
  const catalog = createSystemFactCatalog(SAYC_SYSTEM_CONFIG);
  const relEv = catalog.relationalEvaluators!;

  it("inviteValues: uses trump TP when fitAgreed present", () => {
    // 8 HCP, shape [3,4,2,4], agreed hearts → tp = 8 + 1 (doubleton diamonds) = 9
    // SAYC inviteMinTp.trump = 8, inviteMaxTp.trump = 10 → 9 is in range → true
    const m = handMap(8, [3, 4, 2, 4]);
    const ctx = { fitAgreed: { strain: ObsSuit.Hearts, confidence: ConfidenceLevel.Final as const } };
    const result = relEv.get(SYSTEM_RESPONDER_INVITE_VALUES)!(undefined as any, undefined as any, m, ctx);
    expect(result.value).toBe(true);
  });

  it("inviteValues: trump TP out of range → false", () => {
    // 11 HCP, shape [3,4,3,0], agreed hearts → tp = 11 + 3 (void clubs) = 14
    // 14 > inviteMaxTp.trump (10) → false
    const m = handMap(11, [3, 4, 3, 0]);
    const ctx = { fitAgreed: { strain: ObsSuit.Hearts, confidence: ConfidenceLevel.Final as const } };
    const result = relEv.get(SYSTEM_RESPONDER_INVITE_VALUES)!(undefined as any, undefined as any, m, ctx);
    expect(result.value).toBe(false);
  });

  it("inviteValues: same hand without fitAgreed uses HCP → false (11 > inviteMax 9)", () => {
    const m = handMap(11, [3, 4, 3, 0]);
    const ctx = {};
    const result = relEv.get(SYSTEM_RESPONDER_INVITE_VALUES)!(undefined as any, undefined as any, m, ctx);
    expect(result.value).toBe(false);
  });

  it("gameValues: trump TP >= gameMinTp.trump → true", () => {
    // 8 HCP, shape [3,4,2,4], agreed hearts → tp = 8 + 1 = 9
    // SAYC gameMinTp.trump = 10 → 9 < 10 → false
    const m = handMap(8, [3, 4, 2, 4]);
    const ctx = { fitAgreed: { strain: ObsSuit.Hearts, confidence: ConfidenceLevel.Final as const } };
    const result = relEv.get(SYSTEM_RESPONDER_GAME_VALUES)!(undefined as any, undefined as any, m, ctx);
    expect(result.value).toBe(false);
  });

  it("slamValues: uses trump TP with fit", () => {
    // 14 HCP, shape [3,5,0,5], agreed hearts → tp = 14 + 3 (void diamonds) = 17
    // SAYC slamMinTp.trump = 16 → 17 >= 16 → true
    const m = handMap(14, [3, 5, 0, 5]);
    const ctx = { fitAgreed: { strain: ObsSuit.Hearts, confidence: ConfidenceLevel.Final as const } };
    const result = relEv.get(SYSTEM_RESPONDER_SLAM_VALUES)!(undefined as any, undefined as any, m, ctx);
    expect(result.value).toBe(true);
  });

  it("backward compat: without relational context, HCP behavior is preserved", () => {
    const noFitCtx = {};
    // SAYC: inviteMin=8, inviteMax=9
    expect(
      relEv.get(SYSTEM_RESPONDER_INVITE_VALUES)!(undefined as any, undefined as any, hcpMap(8), noFitCtx).value,
    ).toBe(true);
    expect(
      relEv.get(SYSTEM_RESPONDER_INVITE_VALUES)!(undefined as any, undefined as any, hcpMap(10), noFitCtx).value,
    ).toBe(false);
    // SAYC: gameMin=10
    expect(
      relEv.get(SYSTEM_RESPONDER_GAME_VALUES)!(undefined as any, undefined as any, hcpMap(10), noFitCtx).value,
    ).toBe(true);
    expect(
      relEv.get(SYSTEM_RESPONDER_GAME_VALUES)!(undefined as any, undefined as any, hcpMap(9), noFitCtx).value,
    ).toBe(false);
  });
});
