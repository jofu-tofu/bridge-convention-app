import { describe, it, expect } from "vitest";
import type { RuleModule, Rule, NegotiationExpr } from "../../../conventions/core/rule-module";
import type { BidMeaning } from "../../../core/contracts/meaning";
import {
  lintModule,
  computePhaseReachability,
  detectUnreachablePhases,
  detectDeadRules,
  detectBroadRules,
  detectOrphanTransitions,
  detectUndeclaredWrites,
  detectDuplicateEncodings,
} from "../lint";

// ── Factories ───────────────────────────────────────────────────────

function makeModule(overrides: Partial<RuleModule> = {}): RuleModule {
  return {
    id: "test-mod",
    local: { initial: "idle", transitions: [] },
    rules: [],
    facts: { definitions: [], evaluators: new Map() },
    explanationEntries: [],
    ...overrides,
  };
}

function makeSurface(
  meaningId: string,
  callOverride?: { type: "bid"; level: number; strain: string },
): BidMeaning {
  return {
    meaningId,
    semanticClassId: `test:${meaningId}`,
    teachingLabel: meaningId,
    sourceIntent: { type: "TestIntent", params: {} },
    clauses: [],
    encoding: {
      kind: "direct",
      defaultCall: callOverride ?? { type: "bid", level: 1, strain: "NT" },
    },
    ranking: { recommendationBand: "should", intraModuleOrder: 0 },
  } as unknown as BidMeaning;
}

function makeRule(overrides: Partial<Rule<string>> = {}): Rule<string> {
  return {
    match: {},
    claims: [],
    ...overrides,
  };
}

// ── computePhaseReachability ────────────────────────────────────────

describe("computePhaseReachability", () => {
  it("returns all phases reachable through transitions", () => {
    const mod = makeModule({
      local: {
        initial: "idle",
        transitions: [
          { from: "idle", to: "active", on: { act: "any" } },
          { from: "active", to: "done", on: { act: "any" } },
        ],
      },
    });
    const reachable = computePhaseReachability(mod);
    expect(reachable).toEqual(new Set(["idle", "active", "done"]));
  });

  it("excludes disconnected phases", () => {
    const mod = makeModule({
      local: {
        initial: "idle",
        transitions: [
          { from: "idle", to: "active", on: { act: "any" } },
          { from: "orphan", to: "also-orphan", on: { act: "any" } },
        ],
      },
    });
    const reachable = computePhaseReachability(mod);
    expect(reachable).toEqual(new Set(["idle", "active"]));
    expect(reachable.has("orphan")).toBe(false);
    expect(reachable.has("also-orphan")).toBe(false);
  });

  it("handles array from fields", () => {
    const mod = makeModule({
      local: {
        initial: "idle",
        transitions: [
          { from: ["idle", "waiting"], to: "active", on: { act: "any" } },
        ],
      },
    });
    const reachable = computePhaseReachability(mod);
    // "waiting" is reachable only if we can get to it — it's a from but not reachable from initial
    expect(reachable).toEqual(new Set(["idle", "active"]));
  });
});

// ── detectUnreachablePhases ─────────────────────────────────────────

describe("detectUnreachablePhases", () => {
  it("reports phases in rule guards that are not reachable", () => {
    const mod = makeModule({
      rules: [
        makeRule({ match: { local: "ghost" } }),
      ],
    });
    const reachable = new Set(["idle"]);
    const diags = detectUnreachablePhases(mod, reachable);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.ruleId).toBe("unreachable-phase");
    expect(diags[0]!.severity).toBe("error");
    expect(diags[0]!.location.phase).toBe("ghost");
  });

  it("reports nothing when all guard phases are reachable", () => {
    const mod = makeModule({
      rules: [
        makeRule({ match: { local: "idle" } }),
        makeRule({ match: { local: "active" } }),
      ],
    });
    const reachable = new Set(["idle", "active"]);
    const diags = detectUnreachablePhases(mod, reachable);
    expect(diags).toHaveLength(0);
  });
});

// ── detectDeadRules ─────────────────────────────────────────────────

describe("detectDeadRules", () => {
  it("reports rules guarded by unreachable phases", () => {
    const mod = makeModule({
      rules: [
        makeRule({ match: { local: "reachable" } }),
        makeRule({ match: { local: "unreachable" } }),
      ],
    });
    const reachable = new Set(["reachable"]);
    const diags = detectDeadRules(mod, reachable);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.ruleId).toBe("dead-rule");
    expect(diags[0]!.severity).toBe("error");
    expect(diags[0]!.location.ruleIndex).toBe(1);
  });
});

// ── detectBroadRules ────────────────────────────────────────────────

describe("detectBroadRules", () => {
  it("warns on rules with no local and no route guard", () => {
    const mod = makeModule({
      rules: [
        makeRule({ match: { turn: "opener" } }),
      ],
    });
    const diags = detectBroadRules(mod);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.ruleId).toBe("broad-rule");
    expect(diags[0]!.severity).toBe("warn");
    expect(diags[0]!.location.ruleIndex).toBe(0);
  });

  it("does not warn when rule has local guard", () => {
    const mod = makeModule({
      rules: [
        makeRule({ match: { local: "idle" } }),
      ],
    });
    const diags = detectBroadRules(mod);
    expect(diags).toHaveLength(0);
  });

  it("does not warn when rule has route guard", () => {
    const mod = makeModule({
      rules: [
        makeRule({ match: { route: { kind: "last", pattern: { act: "any" } } } }),
      ],
    });
    const diags = detectBroadRules(mod);
    expect(diags).toHaveLength(0);
  });
});

// ── detectOrphanTransitions ─────────────────────────────────────────

describe("detectOrphanTransitions", () => {
  it("reports transition from unreachable phase", () => {
    const mod = makeModule({
      local: {
        initial: "idle",
        transitions: [
          { from: "idle", to: "active", on: { act: "any" } },
          { from: "disconnected", to: "active", on: { act: "any" } },
        ],
      },
    });
    const reachable = computePhaseReachability(mod);
    const diags = detectOrphanTransitions(mod, reachable);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.ruleId).toBe("orphan-transition");
    expect(diags[0]!.severity).toBe("error");
    expect(diags[0]!.location.transitionIndex).toBe(1);
  });

  it("reports no diagnostics when all transition sources are reachable", () => {
    const mod = makeModule({
      local: {
        initial: "idle",
        transitions: [
          { from: "idle", to: "active", on: { act: "any" } },
          { from: "active", to: "done", on: { act: "any" } },
        ],
      },
    });
    const reachable = computePhaseReachability(mod);
    const diags = detectOrphanTransitions(mod, reachable);
    expect(diags).toHaveLength(0);
  });

  it("does not flag reachable terminal phases", () => {
    const mod = makeModule({
      local: {
        initial: "idle",
        transitions: [
          { from: "idle", to: "active", on: { act: "any" } },
          { from: "active", to: "terminal", on: { act: "any" } },
        ],
      },
    });
    const reachable = computePhaseReachability(mod);
    const diags = detectOrphanTransitions(mod, reachable);
    expect(diags).toHaveLength(0);
  });
});

// ── detectUndeclaredWrites ──────────────────────────────────────────

describe("detectUndeclaredWrites", () => {
  it("warns when negotiationDelta writes a field not read by any kernel expr", () => {
    const mod = makeModule({
      rules: [
        makeRule({
          match: { local: "idle" },
          claims: [
            {
              surface: makeSurface("s1"),
              negotiationDelta: { forcing: "game" },
            },
          ],
        }),
      ],
    });
    const diags = detectUndeclaredWrites(mod);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.ruleId).toBe("undeclared-write");
    expect(diags[0]!.severity).toBe("warn");
  });

  it("no diagnostic when negotiationDelta field is read by a kernel expr", () => {
    const kernelExpr: NegotiationExpr = { kind: "forcing", level: "game" };
    const mod = makeModule({
      rules: [
        makeRule({
          match: { local: "idle", kernel: kernelExpr },
          claims: [
            {
              surface: makeSurface("s1"),
              negotiationDelta: { forcing: "game" },
            },
          ],
        }),
      ],
    });
    const diags = detectUndeclaredWrites(mod);
    expect(diags).toHaveLength(0);
  });
});

// ── detectDuplicateEncodings ────────────────────────────────────────

describe("detectDuplicateEncodings", () => {
  it("reports two claims in the same rule with the same call and same meaningId", () => {
    const mod = makeModule({
      rules: [
        makeRule({
          match: { local: "idle" },
          claims: [
            { surface: makeSurface("s1", { type: "bid", level: 2, strain: "C" }) },
            { surface: makeSurface("s1", { type: "bid", level: 2, strain: "C" }) },
          ],
        }),
      ],
    });
    const diags = detectDuplicateEncodings(mod);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.ruleId).toBe("duplicate-encoding");
    expect(diags[0]!.severity).toBe("error");
    expect(diags[0]!.location.ruleIndex).toBe(0);
  });

  it("does not flag different meaningIds with the same encoding", () => {
    const mod = makeModule({
      rules: [
        makeRule({
          match: { local: "idle" },
          claims: [
            { surface: makeSurface("s1", { type: "bid", level: 2, strain: "C" }) },
            { surface: makeSurface("s2", { type: "bid", level: 2, strain: "C" }) },
          ],
        }),
      ],
    });
    const diags = detectDuplicateEncodings(mod);
    expect(diags).toHaveLength(0);
  });

  it("no diagnostic when claims have different calls", () => {
    const mod = makeModule({
      rules: [
        makeRule({
          match: { local: "idle" },
          claims: [
            { surface: makeSurface("s1", { type: "bid", level: 2, strain: "C" }) },
            { surface: makeSurface("s2", { type: "bid", level: 2, strain: "D" }) },
          ],
        }),
      ],
    });
    const diags = detectDuplicateEncodings(mod);
    expect(diags).toHaveLength(0);
  });
});

// ── lintModule ──────────────────────────────────────────────────────

describe("lintModule", () => {
  it("returns empty diagnostics for a clean module", () => {
    const mod = makeModule({
      local: {
        initial: "idle",
        transitions: [
          { from: "idle", to: "active", on: { act: "any" } },
        ],
      },
      rules: [
        makeRule({
          match: { local: "idle" },
          claims: [
            { surface: makeSurface("s1") },
          ],
        }),
      ],
    });
    const diags = lintModule(mod);
    expect(diags).toHaveLength(0);
  });
});
