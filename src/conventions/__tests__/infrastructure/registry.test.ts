import { describe, test, expect, beforeEach } from "vitest";
import {
  registerConvention,
  getConvention,
  listConventions,
  listConventionIds,
  clearRegistry,
} from "../../registry";
import type { ConventionConfig } from "../../types";
import { ConventionCategory } from "../../types";
import type { BiddingRule } from "../../types";
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

