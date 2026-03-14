/**
 * Tests for evidence-inference-adapter — converts EvidenceBundleIR to HandInference.
 * Mirrors the test patterns from tree-inference-extractor.test.ts.
 */
import { describe, test, expect } from "vitest";
import { Seat } from "../../engine/types";
import type {
  EvidenceBundleIR,
  ConditionEvidenceIR,
} from "../../core/contracts/evidence-bundle";
import {
  extractInferenceFromEvidence,
  evidenceToConditionInference,
} from "../evidence-inference-adapter";

// ─── evidenceToConditionInference ───────────────────────────

describe("evidenceToConditionInference", () => {
  test("maps hand.hcp gte (satisfied, observed >= threshold) to hcp-min", () => {
    const evidence: ConditionEvidenceIR = {
      conditionId: "hand.hcp",
      factId: "hand.hcp",
      satisfied: true,
      observedValue: 16,
      threshold: 15,
    };
    expect(evidenceToConditionInference(evidence)).toEqual({
      type: "hcp-min",
      params: { min: 15 },
    });
  });

  test("maps hand.hcp lte (satisfied, observed < threshold) to hcp-max", () => {
    const evidence: ConditionEvidenceIR = {
      conditionId: "hand.hcp",
      factId: "hand.hcp",
      satisfied: true,
      observedValue: 15,
      threshold: 17,
    };
    expect(evidenceToConditionInference(evidence)).toEqual({
      type: "hcp-max",
      params: { max: 17 },
    });
  });

  test("maps hand.hcp range threshold to hcp-range", () => {
    const evidence: ConditionEvidenceIR = {
      conditionId: "hand.hcp",
      factId: "hand.hcp",
      satisfied: true,
      observedValue: 16,
      threshold: { min: 15, max: 17 },
    };
    expect(evidenceToConditionInference(evidence)).toEqual({
      type: "hcp-range",
      params: { min: 15, max: 17 },
    });
  });

  test("maps failed hand.hcp gte (observed < threshold) to hcp-min", () => {
    const evidence: ConditionEvidenceIR = {
      conditionId: "hand.hcp",
      factId: "hand.hcp",
      satisfied: false,
      observedValue: 10,
      threshold: 12,
    };
    // Original condition was gte → hcp-min (caller inverts for negative inference)
    expect(evidenceToConditionInference(evidence)).toEqual({
      type: "hcp-min",
      params: { min: 12 },
    });
  });

  test("maps failed hand.hcp lte (observed > threshold) to hcp-max", () => {
    const evidence: ConditionEvidenceIR = {
      conditionId: "hand.hcp",
      factId: "hand.hcp",
      satisfied: false,
      observedValue: 20,
      threshold: 17,
    };
    // Original condition was lte → hcp-max (caller inverts for negative inference)
    expect(evidenceToConditionInference(evidence)).toEqual({
      type: "hcp-max",
      params: { max: 17 },
    });
  });

  test("maps hand.suitLength.hearts gte to suit-min", () => {
    const evidence: ConditionEvidenceIR = {
      conditionId: "hand.suitLength.hearts",
      factId: "hand.suitLength.hearts",
      satisfied: true,
      observedValue: 5,
      threshold: 4,
    };
    expect(evidenceToConditionInference(evidence)).toEqual({
      type: "suit-min",
      params: { min: 4, suitIndex: 1 },
    });
  });

  test("maps hand.suitLength.spades lte to suit-max", () => {
    const evidence: ConditionEvidenceIR = {
      conditionId: "hand.suitLength.spades",
      factId: "hand.suitLength.spades",
      satisfied: true,
      observedValue: 2,
      threshold: 3,
    };
    expect(evidenceToConditionInference(evidence)).toEqual({
      type: "suit-max",
      params: { max: 3, suitIndex: 0 },
    });
  });

  test("maps bridge.isBalanced true to balanced", () => {
    const evidence: ConditionEvidenceIR = {
      conditionId: "bridge.isBalanced",
      factId: "bridge.isBalanced",
      satisfied: true,
      observedValue: true,
      threshold: true,
    };
    expect(evidenceToConditionInference(evidence)).toEqual({
      type: "balanced",
      params: {},
    });
  });

  test("falls back to conditionId when factId is missing", () => {
    const evidence: ConditionEvidenceIR = {
      conditionId: "hand.hcp",
      satisfied: true,
      observedValue: 16,
      threshold: 15,
    };
    expect(evidenceToConditionInference(evidence)).toEqual({
      type: "hcp-min",
      params: { min: 15 },
    });
  });

  test("defaults to min direction when no observedValue", () => {
    const evidence: ConditionEvidenceIR = {
      conditionId: "hand.hcp",
      factId: "hand.hcp",
      satisfied: true,
      threshold: 12,
    };
    expect(evidenceToConditionInference(evidence)).toEqual({
      type: "hcp-min",
      params: { min: 12 },
    });
  });

  test("returns null for unrecognized factId", () => {
    const evidence: ConditionEvidenceIR = {
      conditionId: "bridge.hasFourCardMajor",
      factId: "bridge.hasFourCardMajor",
      satisfied: true,
      observedValue: true,
      threshold: true,
    };
    expect(evidenceToConditionInference(evidence)).toBeNull();
  });

  test("returns null when threshold is missing", () => {
    const evidence: ConditionEvidenceIR = {
      conditionId: "hand.hcp",
      factId: "hand.hcp",
      satisfied: true,
      observedValue: 15,
    };
    expect(evidenceToConditionInference(evidence)).toBeNull();
  });

  test("returns null for unrecognized suit name", () => {
    const evidence: ConditionEvidenceIR = {
      conditionId: "hand.suitLength.notrump",
      factId: "hand.suitLength.notrump",
      satisfied: true,
      observedValue: 5,
      threshold: 4,
    };
    expect(evidenceToConditionInference(evidence)).toBeNull();
  });
});

// ─── extractInferenceFromEvidence ───────────────────────────

describe("extractInferenceFromEvidence", () => {
  test("extracts positive HCP inference from matched conditions", () => {
    const evidence: EvidenceBundleIR = {
      matched: {
        meaningId: "1nt-opening",
        satisfiedConditions: [
          {
            conditionId: "hand.hcp",
            factId: "hand.hcp",
            satisfied: true,
            observedValue: 16,
            threshold: 15,
          },
        ],
      },
      rejected: [],
      alternatives: [],
      exhaustive: true,
      fallbackReached: false,
    };
    const result = extractInferenceFromEvidence(evidence, Seat.North);
    expect(result).not.toBeNull();
    expect(result!.minHcp).toBe(15);
    expect(result!.seat).toBe(Seat.North);
    expect(result!.source).toBe("1nt-opening");
  });

  test("extracts positive suit length inference from matched conditions", () => {
    const evidence: EvidenceBundleIR = {
      matched: {
        meaningId: "1h-response",
        satisfiedConditions: [
          {
            conditionId: "hand.suitLength.hearts",
            factId: "hand.suitLength.hearts",
            satisfied: true,
            observedValue: 5,
            threshold: 4,
          },
        ],
      },
      rejected: [],
      alternatives: [],
      exhaustive: true,
      fallbackReached: false,
    };
    const result = extractInferenceFromEvidence(evidence, Seat.South);
    expect(result).not.toBeNull();
    expect(result!.suits.H?.minLength).toBe(4);
  });

  test("extracts negated inference from rejected negatableFailures", () => {
    const evidence: EvidenceBundleIR = {
      matched: {
        meaningId: "2d-stayman-denial",
        satisfiedConditions: [
          {
            conditionId: "hand.hcp",
            factId: "hand.hcp",
            satisfied: true,
            observedValue: 16,
            threshold: 15,
          },
        ],
      },
      rejected: [
        {
          meaningId: "2h-stayman-hearts",
          failedConditions: [
            {
              conditionId: "hand.suitLength.hearts",
              factId: "hand.suitLength.hearts",
              satisfied: false,
              observedValue: 3,
              threshold: 4,
            },
          ],
          moduleId: "stayman",
          negatableFailures: [
            {
              conditionId: "hand.suitLength.hearts",
              factId: "hand.suitLength.hearts",
              satisfied: false,
              observedValue: 3,
              threshold: 4,
            },
          ],
        },
      ],
      alternatives: [],
      exhaustive: true,
      fallbackReached: false,
    };
    const result = extractInferenceFromEvidence(evidence, Seat.North);
    expect(result).not.toBeNull();
    // Positive: minHcp 15
    expect(result!.minHcp).toBe(15);
    // Negated: suit-min hearts 4 → inverted to suit-max hearts 3
    expect(result!.suits.H?.maxLength).toBe(3);
  });

  test("returns null when matched is null (no winning meaning)", () => {
    const evidence: EvidenceBundleIR = {
      matched: null,
      rejected: [],
      alternatives: [],
      exhaustive: false,
      fallbackReached: true,
    };
    expect(extractInferenceFromEvidence(evidence, Seat.North)).toBeNull();
  });

  test("handles empty evidence bundle (matched with no conditions)", () => {
    const evidence: EvidenceBundleIR = {
      matched: {
        meaningId: "some-meaning",
        satisfiedConditions: [],
      },
      rejected: [],
      alternatives: [],
      exhaustive: true,
      fallbackReached: false,
    };
    expect(extractInferenceFromEvidence(evidence, Seat.North)).toBeNull();
  });

  test("uses custom source when provided", () => {
    const evidence: EvidenceBundleIR = {
      matched: {
        meaningId: "1nt-opening",
        satisfiedConditions: [
          {
            conditionId: "hand.hcp",
            factId: "hand.hcp",
            satisfied: true,
            observedValue: 16,
            threshold: 15,
          },
        ],
      },
      rejected: [],
      alternatives: [],
      exhaustive: true,
      fallbackReached: false,
    };
    const result = extractInferenceFromEvidence(
      evidence,
      Seat.North,
      "custom-source",
    );
    expect(result!.source).toBe("custom-source");
  });

  test("skips unmappable conditions (unrecognized factIds)", () => {
    const evidence: EvidenceBundleIR = {
      matched: {
        meaningId: "test-meaning",
        satisfiedConditions: [
          {
            conditionId: "bridge.hasFourCardMajor",
            factId: "bridge.hasFourCardMajor",
            satisfied: true,
            observedValue: true,
            threshold: true,
          },
        ],
      },
      rejected: [],
      alternatives: [],
      exhaustive: true,
      fallbackReached: false,
    };
    // All conditions are unmappable → null
    expect(extractInferenceFromEvidence(evidence, Seat.North)).toBeNull();
  });

  test("combines multiple positive conditions into merged inference", () => {
    const evidence: EvidenceBundleIR = {
      matched: {
        meaningId: "1nt-opening",
        satisfiedConditions: [
          {
            conditionId: "hand.hcp",
            factId: "hand.hcp",
            satisfied: true,
            observedValue: 16,
            threshold: 15,
          },
          {
            conditionId: "hand.hcp",
            factId: "hand.hcp",
            satisfied: true,
            observedValue: 16,
            threshold: 17,
          },
        ],
      },
      rejected: [],
      alternatives: [],
      exhaustive: true,
      fallbackReached: false,
    };
    const result = extractInferenceFromEvidence(evidence, Seat.North);
    expect(result).not.toBeNull();
    // First: gte 15 → minHcp 15, second: lte 17 → maxHcp 17
    expect(result!.minHcp).toBe(15);
    expect(result!.maxHcp).toBe(17);
  });

  test("handles multiple rejected meanings with negatable failures", () => {
    const evidence: EvidenceBundleIR = {
      matched: {
        meaningId: "2d-stayman-denial",
        satisfiedConditions: [
          {
            conditionId: "hand.hcp",
            factId: "hand.hcp",
            satisfied: true,
            observedValue: 16,
            threshold: 15,
          },
        ],
      },
      rejected: [
        {
          meaningId: "2h-stayman-hearts",
          failedConditions: [],
          moduleId: "stayman",
          negatableFailures: [
            {
              conditionId: "hand.suitLength.hearts",
              factId: "hand.suitLength.hearts",
              satisfied: false,
              observedValue: 3,
              threshold: 4,
            },
          ],
        },
        {
          meaningId: "2s-stayman-spades",
          failedConditions: [],
          moduleId: "stayman",
          negatableFailures: [
            {
              conditionId: "hand.suitLength.spades",
              factId: "hand.suitLength.spades",
              satisfied: false,
              observedValue: 2,
              threshold: 4,
            },
          ],
        },
      ],
      alternatives: [],
      exhaustive: true,
      fallbackReached: false,
    };
    const result = extractInferenceFromEvidence(evidence, Seat.North);
    expect(result).not.toBeNull();
    expect(result!.minHcp).toBe(15);
    // Both suit-min 4 → inverted to suit-max 3
    expect(result!.suits.H?.maxLength).toBe(3);
    expect(result!.suits.S?.maxLength).toBe(3);
  });

  test("skips rejected meanings without negatableFailures", () => {
    const evidence: EvidenceBundleIR = {
      matched: {
        meaningId: "test-meaning",
        satisfiedConditions: [
          {
            conditionId: "hand.hcp",
            factId: "hand.hcp",
            satisfied: true,
            observedValue: 16,
            threshold: 15,
          },
        ],
      },
      rejected: [
        {
          meaningId: "rejected-meaning",
          failedConditions: [
            {
              conditionId: "hand.suitLength.hearts",
              factId: "hand.suitLength.hearts",
              satisfied: false,
              observedValue: 3,
              threshold: 4,
            },
          ],
          moduleId: "test",
          // No negatableFailures field
        },
      ],
      alternatives: [],
      exhaustive: true,
      fallbackReached: false,
    };
    const result = extractInferenceFromEvidence(evidence, Seat.North);
    expect(result).not.toBeNull();
    // Only positive inference, no negation
    expect(result!.minHcp).toBe(15);
    expect(result!.suits.H).toBeUndefined();
  });
});
