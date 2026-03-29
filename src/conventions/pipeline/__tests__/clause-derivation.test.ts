import { describe, it, expect } from "vitest";
import {
  deriveClauseId,
  deriveClauseDescription,
  fillClauseDefaults,
} from "../evaluation/clause-derivation";
import { FactOperator } from "../evaluation/meaning";

describe("deriveClauseId", () => {
  it("produces deterministic ID for number + gte", () => {
    expect(deriveClauseId("hand.hcp", FactOperator.Gte, 12)).toBe("hand.hcp:gte:12");
  });

  it("produces deterministic ID for number + lte", () => {
    expect(deriveClauseId("hand.hcp", FactOperator.Lte, 6)).toBe("hand.hcp:lte:6");
  });

  it("produces deterministic ID for number + eq", () => {
    expect(deriveClauseId("hand.suitLength.hearts", FactOperator.Eq, 5)).toBe(
      "hand.suitLength.hearts:eq:5",
    );
  });

  it("produces deterministic ID for boolean", () => {
    expect(deriveClauseId("bridge.hasFourCardMajor", FactOperator.Boolean, true)).toBe(
      "bridge.hasFourCardMajor:boolean:true",
    );
    expect(deriveClauseId("bridge.hasFiveCardMajor", FactOperator.Boolean, false)).toBe(
      "bridge.hasFiveCardMajor:boolean:false",
    );
  });

  it("produces deterministic ID for range", () => {
    expect(deriveClauseId("hand.hcp", FactOperator.Range, { min: 10, max: 12 })).toBe(
      "hand.hcp:range:10-12",
    );
  });

  it("produces deterministic ID for in operator", () => {
    expect(deriveClauseId("hand.suit", FactOperator.In, ["hearts", "spades"])).toBe(
      "hand.suit:in:hearts,spades",
    );
  });

  it("preserves $suit binding references", () => {
    expect(deriveClauseId("hand.suitLength.$suit", FactOperator.Gte, 4)).toBe(
      "hand.suitLength.$suit:gte:4",
    );
  });
});

describe("deriveClauseDescription", () => {
  it("produces natural language for gte", () => {
    expect(deriveClauseDescription("hand.hcp", FactOperator.Gte, 12)).toBe("12+ HCP");
  });

  it("produces natural language for lte", () => {
    expect(deriveClauseDescription("hand.hcp", FactOperator.Lte, 6)).toBe("At most 6 HCP");
  });

  it("produces natural language for eq", () => {
    expect(deriveClauseDescription("hand.suitLength.hearts", FactOperator.Eq, 5)).toBe(
      "Exactly 5 hearts",
    );
  });

  it("produces natural language for range", () => {
    expect(deriveClauseDescription("hand.hcp", FactOperator.Range, { min: 10, max: 12 })).toBe(
      "10–12 HCP",
    );
  });

  it("produces natural language for boolean true (noun-like)", () => {
    expect(deriveClauseDescription("bridge.hasFourCardMajor", FactOperator.Boolean, true)).toBe(
      "Has a 4-card major",
    );
  });

  it("produces natural language for boolean false", () => {
    expect(deriveClauseDescription("bridge.hasFiveCardMajor", FactOperator.Boolean, false)).toBe(
      "No 5-card major",
    );
  });

  it("strips module prefix", () => {
    expect(deriveClauseDescription("module.stayman.eligible", FactOperator.Boolean, true)).toBe(
      "Eligible",
    );
  });

  it("strips hand prefix for isBalanced", () => {
    expect(deriveClauseDescription("hand.isBalanced", FactOperator.Boolean, true)).toBe(
      "Balanced",
    );
  });

  it("preserves $suit binding references", () => {
    expect(deriveClauseDescription("hand.suitLength.$suit", FactOperator.Gte, 4)).toBe(
      "4+ $suit",
    );
  });

  it("handles multi-segment module facts", () => {
    expect(
      deriveClauseDescription("module.weakTwo.topHonorCount.$suit", FactOperator.Gte, 2),
    ).toBe("2+ top honor count $suit");
  });

  it("extracts suit name from suitLength path", () => {
    expect(deriveClauseDescription("hand.suitLength.spades", FactOperator.Gte, 5)).toBe("5+ spades");
  });

  it("handles bridge.hasShortage", () => {
    expect(deriveClauseDescription("bridge.hasShortage", FactOperator.Boolean, true)).toBe("Has a short suit");
  });

  it("handles bridge.fitWithBoundSuit", () => {
    expect(deriveClauseDescription("bridge.fitWithBoundSuit", FactOperator.Boolean, true)).toBe(
      "Has a fit with partner's suit",
    );
  });

  it("handles bridge.totalPointsForRaise", () => {
    expect(deriveClauseDescription("bridge.totalPointsForRaise", FactOperator.Gte, 10)).toBe("10+ total points");
  });

  it("handles in operator", () => {
    expect(deriveClauseDescription("hand.suit", FactOperator.In, ["hearts", "spades"])).toBe(
      "suit in [hearts, spades]",
    );
  });
});

describe("fillClauseDefaults", () => {
  it("returns clause unchanged when both clauseId and description are present", () => {
    const clause = {
      factId: "hand.hcp",
      operator: FactOperator.Gte as const,
      value: 12,
      clauseId: "custom-id",
      description: "Custom desc",
    } as Parameters<typeof fillClauseDefaults>[0] & { description: string };
    const result = fillClauseDefaults(clause);
    expect(result).toBe(clause); // same reference — no copy
  });

  it("fills missing clauseId", () => {
    const clause = {
      factId: "hand.hcp",
      operator: FactOperator.Gte as const,
      value: 12,
      description: "Custom desc",
    } as Parameters<typeof fillClauseDefaults>[0] & { description: string };
    const result = fillClauseDefaults(clause);
    expect(result.clauseId).toBe("hand.hcp:gte:12");
    expect(result.description).toBe("Custom desc");
  });

  it("fills missing description", () => {
    const clause = {
      factId: "hand.hcp",
      operator: FactOperator.Gte as const,
      value: 12,
      clauseId: "custom-id",
    };
    const result = fillClauseDefaults(clause);
    expect(result.clauseId).toBe("custom-id");
    expect(result.description).toBe("12+ HCP");
  });

  it("fills both missing clauseId and description", () => {
    const clause = {
      factId: "bridge.hasFourCardMajor",
      operator: FactOperator.Boolean as const,
      value: true,
    };
    const result = fillClauseDefaults(clause);
    expect(result.clauseId).toBe("bridge.hasFourCardMajor:boolean:true");
    expect(result.description).toBe("Has a 4-card major");
  });
});
