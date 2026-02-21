import { describe, test, expect, beforeEach } from "vitest";
import {
  registerConvention,
  getConvention,
  listConventions,
  listConventionIds,
  evaluateBiddingRules,
  clearRegistry,
} from "../registry";
import type { ConventionConfig } from "../types";
import { ConventionCategory } from "../types";
import type { BiddingRule, BiddingContext } from "../types";
import { Seat, BidSuit } from "../../engine/types";

/** Minimal convention config for testing registry mechanics. */
function makeTestConfig(id: string, rules?: BiddingRule[]): ConventionConfig {
  return {
    id,
    name: `Test ${id}`,
    description: `Test convention ${id}`,
    category: ConventionCategory.Asking,
    dealConstraints: { seats: [] },
    biddingRules: rules ?? [],
    examples: [],
  };
}

function makeRule(name: string, shouldMatch: boolean): BiddingRule {
  return {
    name,
    explanation: `Test rule ${name}`,
    matches: () => shouldMatch,
    call: () => ({ type: "bid", level: 2, strain: BidSuit.Clubs }),
  };
}

describe("convention registry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  test("register + retrieve by ID", () => {
    const config = makeTestConfig("test-conv");
    registerConvention(config);
    const retrieved = getConvention("test-conv");
    expect(retrieved).toBe(config);
  });

  test("duplicate ID throws", () => {
    registerConvention(makeTestConfig("dup"));
    expect(() => registerConvention(makeTestConfig("dup"))).toThrow(
      /already registered/,
    );
  });

  test("unknown ID throws with helpful message listing available conventions", () => {
    registerConvention(makeTestConfig("alpha"));
    registerConvention(makeTestConfig("beta"));
    expect(() => getConvention("gamma")).toThrow(/gamma/);
    expect(() => getConvention("gamma")).toThrow(/alpha/);
    expect(() => getConvention("gamma")).toThrow(/beta/);
  });

  test("listConventions returns all registered", () => {
    registerConvention(makeTestConfig("a"));
    registerConvention(makeTestConfig("b"));
    const list = listConventions();
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.id)).toContain("a");
    expect(list.map((c) => c.id)).toContain("b");
  });

  test("listConventionIds returns string array", () => {
    registerConvention(makeTestConfig("x"));
    registerConvention(makeTestConfig("y"));
    const ids = listConventionIds();
    expect(ids).toEqual(expect.arrayContaining(["x", "y"]));
    expect(ids).toHaveLength(2);
  });

  test("clearRegistry empties registry", () => {
    registerConvention(makeTestConfig("foo"));
    expect(listConventions()).toHaveLength(1);
    clearRegistry();
    expect(listConventions()).toHaveLength(0);
  });
});

describe("evaluateBiddingRules", () => {
  // Minimal context — rules in these tests don't use it
  const dummyContext: BiddingContext = {
    hand: { cards: [] },
    auction: { entries: [], isComplete: false },
    seat: Seat.South,
    evaluation: {
      hcp: 10,
      distribution: { shortness: 0, length: 0, total: 0 },
      shape: [3, 3, 4, 3],
      totalPoints: 10,
      strategy: "HCP",
    },
  };

  test("returns first matching rule", () => {
    const rules = [
      makeRule("rule-a", true),
      makeRule("rule-b", true),
    ];
    const result = evaluateBiddingRules(rules, dummyContext);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("rule-a");
  });

  test("returns null when no rules match", () => {
    const rules = [
      makeRule("rule-a", false),
      makeRule("rule-b", false),
    ];
    const result = evaluateBiddingRules(rules, dummyContext);
    expect(result).toBeNull();
  });

  test("skips non-matching rules, finds later match", () => {
    const rules = [
      makeRule("skip-me", false),
      makeRule("match-me", true),
    ];
    const result = evaluateBiddingRules(rules, dummyContext);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("match-me");
  });

  test("priority order respected (first match wins, not best match)", () => {
    const rules = [
      makeRule("first", true),
      makeRule("second", true),
      makeRule("third", true),
    ];
    const result = evaluateBiddingRules(rules, dummyContext);
    expect(result!.rule).toBe("first");
  });
});
