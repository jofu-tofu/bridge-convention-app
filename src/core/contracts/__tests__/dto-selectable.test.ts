import { describe, test, expect } from "vitest";
import { isDtoSelectable } from "../tree-evaluation";
import type { ResolvedCandidateDTO, CandidateEligibility } from "../tree-evaluation";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";

const call: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };

function makeDto(
  overrides: Partial<ResolvedCandidateDTO> = {},
): ResolvedCandidateDTO {
  return {
    bidName: "test",
    meaning: "Test",
    call,
    resolvedCall: call,
    isDefaultCall: true,
    legal: true,
    isMatched: false,
    intentType: "Signoff",
    failedConditions: [],
    ...overrides,
  };
}

function makeEligibility(overrides: Partial<CandidateEligibility> = {}): CandidateEligibility {
  return {
    hand: { satisfied: true, failedConditions: [] },
    protocol: { satisfied: true, reasons: [] },
    encoding: { legal: true },
    pedagogical: { acceptable: true, reasons: [] },
    ...overrides,
  };
}

describe("isDtoSelectable", () => {
  describe("with eligibility present", () => {
    test("all dimensions satisfied → selectable", () => {
      const dto = makeDto({ eligibility: makeEligibility() });
      expect(isDtoSelectable(dto)).toBe(true);
    });

    test("hand unsatisfied → not selectable", () => {
      const dto = makeDto({
        eligibility: makeEligibility({
          hand: { satisfied: false, failedConditions: [{ name: "hcp", description: "Need 10+" }] },
        }),
      });
      expect(isDtoSelectable(dto)).toBe(false);
    });

    test("protocol unsatisfied → not selectable", () => {
      const dto = makeDto({
        eligibility: makeEligibility({
          protocol: { satisfied: false, reasons: ["suppressed"] },
        }),
      });
      expect(isDtoSelectable(dto)).toBe(false);
    });

    test("encoding illegal → not selectable", () => {
      const dto = makeDto({
        eligibility: makeEligibility({
          encoding: { legal: false },
        }),
      });
      expect(isDtoSelectable(dto)).toBe(false);
    });

    test("pedagogically unacceptable → not selectable", () => {
      const dto = makeDto({
        eligibility: makeEligibility({
          pedagogical: { acceptable: false, reasons: ["not teachable"] },
        }),
      });
      expect(isDtoSelectable(dto)).toBe(false);
    });
  });

  describe("legacy fallback (no eligibility)", () => {
    test("legal + no failedConditions → selectable", () => {
      const dto = makeDto({ legal: true, failedConditions: [] });
      expect(isDtoSelectable(dto)).toBe(true);
    });

    test("illegal → not selectable", () => {
      const dto = makeDto({ legal: false, failedConditions: [] });
      expect(isDtoSelectable(dto)).toBe(false);
    });

    test("failedConditions present → not selectable", () => {
      const dto = makeDto({
        legal: true,
        failedConditions: [{ name: "hcp", description: "Need 10+" }],
      });
      expect(isDtoSelectable(dto)).toBe(false);
    });
  });
});
