import { describe, it, expect } from "vitest";
import type { RuleCondition } from "../../conventions/core/types";
import type { BiddingContext } from "../../conventions/core/types";
import type { ConventionExplanations } from "../../conventions/core/rule-tree";
import type { HandEvaluation } from "../../engine/types";
import {
  getConditionExplanation,
  getConditionExplanationWithParams,
  getFailureExplanation,
} from "../condition-explanations";

function stubCondition(
  overrides: Partial<RuleCondition> & { name: string },
): RuleCondition {
  return {
    label: overrides.label ?? overrides.name,
    category: overrides.category ?? "hand",
    test: () => true,
    describe: () => "",
    ...overrides,
  };
}

function stubContext(
  overrides: Partial<HandEvaluation> = {},
): BiddingContext {
  const evaluation: HandEvaluation = {
    hcp: overrides.hcp ?? 10,
    distribution: overrides.distribution ?? {
      shortness: 0,
      length: 0,
      total: 0,
    },
    shape: overrides.shape ?? [3, 3, 4, 3],
    totalPoints: overrides.totalPoints ?? 10,
    strategy: overrides.strategy ?? "hcp",
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial BiddingContext stub for testing
  return { evaluation, hand: { cards: [] } } as any;
}

describe("getConditionExplanation", () => {
  it("returns default explanation for each inference type", () => {
    const types = [
      "hcp-min",
      "hcp-max",
      "hcp-range",
      "suit-min",
      "suit-max",
      "balanced",
      "not-balanced",
      "two-suited",
    ] as const;

    for (const type of types) {
      const condition = stubCondition({
        name: `test-${type}`,
        inference: { type, params: {} },
      });
      const result = getConditionExplanation(condition);
      expect(result, `expected non-null for inference type "${type}"`).not.toBeNull();
      expect(typeof result).toBe("string");
    }
  });

  it("returns convention-specific override over inference default", () => {
    const condition = stubCondition({
      name: "my-hcp-check",
      inference: { type: "hcp-min", params: { min: 8 } },
    });
    const explanations: ConventionExplanations = {
      conditions: { "my-hcp-check": "Special Stayman HCP requirement" },
    };
    expect(getConditionExplanation(condition, explanations)).toBe(
      "Special Stayman HCP requirement",
    );
  });

  it("returns teachingNote over inference default", () => {
    const condition = stubCondition({
      name: "my-condition",
      inference: { type: "hcp-min", params: { min: 8 } },
      teachingNote: "This is a teaching note",
    });
    expect(getConditionExplanation(condition)).toBe("This is a teaching note");
  });

  it("returns convention override over teachingNote", () => {
    const condition = stubCondition({
      name: "my-condition",
      teachingNote: "Teaching note",
      inference: { type: "hcp-min", params: { min: 8 } },
    });
    const explanations: ConventionExplanations = {
      conditions: { "my-condition": "Convention override" },
    };
    expect(getConditionExplanation(condition, explanations)).toBe(
      "Convention override",
    );
  });

  it("returns null when no inference, no teachingNote, no convention override", () => {
    const condition = stubCondition({ name: "bare-condition" });
    expect(getConditionExplanation(condition)).toBeNull();
  });
});

describe("getConditionExplanationWithParams", () => {
  it("interpolates hcp-min threshold", () => {
    const condition = stubCondition({
      name: "hcp-check",
      inference: { type: "hcp-min", params: { min: 8 } },
    });
    expect(getConditionExplanationWithParams(condition)).toBe(
      "Requires at least 8 HCP",
    );
  });

  it("interpolates hcp-max threshold", () => {
    const condition = stubCondition({
      name: "hcp-check",
      inference: { type: "hcp-max", params: { max: 11 } },
    });
    expect(getConditionExplanationWithParams(condition)).toBe(
      "Requires at most 11 HCP",
    );
  });

  it("interpolates hcp-range thresholds", () => {
    const condition = stubCondition({
      name: "hcp-check",
      inference: { type: "hcp-range", params: { min: 10, max: 12 } },
    });
    expect(getConditionExplanationWithParams(condition)).toBe(
      "Requires 10-12 HCP",
    );
  });

  it("interpolates suit-min threshold", () => {
    const condition = stubCondition({
      name: "suit-check",
      inference: { type: "suit-min", params: { suit: "hearts", min: 4 } },
    });
    expect(getConditionExplanationWithParams(condition)).toBe(
      "Requires 4+ hearts",
    );
  });

  it("interpolates suit-max threshold", () => {
    const condition = stubCondition({
      name: "suit-check",
      inference: { type: "suit-max", params: { suit: "spades", max: 3 } },
    });
    expect(getConditionExplanationWithParams(condition)).toBe(
      "Requires at most 3 spades",
    );
  });

  it("returns balanced explanation", () => {
    const condition = stubCondition({
      name: "balanced-check",
      inference: { type: "balanced", params: {} },
    });
    expect(getConditionExplanationWithParams(condition)).toBe(
      "Requires a balanced hand shape",
    );
  });

  it("returns not-balanced explanation", () => {
    const condition = stubCondition({
      name: "unbalanced-check",
      inference: { type: "not-balanced", params: {} },
    });
    expect(getConditionExplanationWithParams(condition)).toBe(
      "Requires an unbalanced hand shape",
    );
  });

  it("returns two-suited explanation", () => {
    const condition = stubCondition({
      name: "two-suited-check",
      inference: { type: "two-suited", params: {} },
    });
    expect(getConditionExplanationWithParams(condition)).toBe(
      "Requires a two-suited hand",
    );
  });

  it("returns convention override over parameterized explanation", () => {
    const condition = stubCondition({
      name: "hcp-check",
      inference: { type: "hcp-min", params: { min: 8 } },
    });
    const explanations: ConventionExplanations = {
      conditions: { "hcp-check": "Custom override" },
    };
    expect(getConditionExplanationWithParams(condition, explanations)).toBe(
      "Custom override",
    );
  });

  it("returns teachingNote over parameterized explanation", () => {
    const condition = stubCondition({
      name: "hcp-check",
      inference: { type: "hcp-min", params: { min: 8 } },
      teachingNote: "My teaching note",
    });
    expect(getConditionExplanationWithParams(condition)).toBe(
      "My teaching note",
    );
  });

  it("returns null when no inference", () => {
    const condition = stubCondition({ name: "bare" });
    expect(getConditionExplanationWithParams(condition)).toBeNull();
  });
});

describe("getFailureExplanation", () => {
  it("returns HCP shortfall for hcp-min", () => {
    const condition = stubCondition({
      name: "hcp-check",
      inference: { type: "hcp-min", params: { min: 12 } },
    });
    const context = stubContext({ hcp: 9 });
    expect(getFailureExplanation(condition, context)).toBe(
      "3 HCP short of the 12 needed",
    );
  });

  it("returns null for hcp-min when hand meets threshold", () => {
    const condition = stubCondition({
      name: "hcp-check",
      inference: { type: "hcp-min", params: { min: 8 } },
    });
    const context = stubContext({ hcp: 10 });
    expect(getFailureExplanation(condition, context)).toBeNull();
  });

  it("returns HCP excess for hcp-max", () => {
    const condition = stubCondition({
      name: "hcp-check",
      inference: { type: "hcp-max", params: { max: 11 } },
    });
    const context = stubContext({ hcp: 14 });
    expect(getFailureExplanation(condition, context)).toBe(
      "3 HCP over the maximum of 11",
    );
  });

  it("returns null for hcp-max when hand meets threshold", () => {
    const condition = stubCondition({
      name: "hcp-check",
      inference: { type: "hcp-max", params: { max: 15 } },
    });
    const context = stubContext({ hcp: 12 });
    expect(getFailureExplanation(condition, context)).toBeNull();
  });

  it("returns suit shortfall for suit-min", () => {
    const condition = stubCondition({
      name: "suit-check",
      inference: { type: "suit-min", params: { suit: "hearts", min: 5 } },
    });
    // shape: [spades, hearts, diamonds, clubs]
    const context = stubContext({ shape: [4, 3, 3, 3] });
    expect(getFailureExplanation(condition, context)).toBe(
      "2 cards short of 5 needed in hearts",
    );
  });

  it("returns null for suit-min when hand meets threshold", () => {
    const condition = stubCondition({
      name: "suit-check",
      inference: { type: "suit-min", params: { suit: "spades", min: 4 } },
    });
    const context = stubContext({ shape: [5, 3, 3, 2] });
    expect(getFailureExplanation(condition, context)).toBeNull();
  });

  it("returns null for unsupported inference type", () => {
    const condition = stubCondition({
      name: "balanced-check",
      inference: { type: "balanced", params: {} },
    });
    const context = stubContext();
    expect(getFailureExplanation(condition, context)).toBeNull();
  });

  it("returns null when condition has no inference", () => {
    const condition = stubCondition({ name: "bare" });
    const context = stubContext();
    expect(getFailureExplanation(condition, context)).toBeNull();
  });
});
