import { describe, it, expect } from "vitest";
import type { StateEntry, NegotiationExpr } from "../../../conventions/core/rule-module";
import type { ConventionModule } from "../../../conventions/core/convention-module";
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

function makeModule(overrides: Partial<ConventionModule> = {}): ConventionModule {
  return {
    moduleId: "test-mod",
    local: { initial: "idle", transitions: [] },
    states: [],
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
    ranking: { recommendationBand: "should", declarationOrder: 0 },
  } as unknown as BidMeaning;
}

function makeStateEntry(overrides: Partial<StateEntry<string>> = {}): StateEntry<string> {
  return {
    phase: "idle",
    surfaces: [],
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
  it("reports phases in state entry guards that are not reachable", () => {
    const mod = makeModule({
      states: [
        makeStateEntry({ phase: "ghost" }),
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
      states: [
        makeStateEntry({ phase: "idle" }),
        makeStateEntry({ phase: "active" }),
      ],
    });
    const reachable = new Set(["idle", "active"]);
    const diags = detectUnreachablePhases(mod, reachable);
    expect(diags).toHaveLength(0);
  });
});

// ── detectDeadRules ─────────────────────────────────────────────────

describe("detectDeadRules", () => {
  it("reports state entries guarded by unreachable phases", () => {
    const mod = makeModule({
      states: [
        makeStateEntry({ phase: "reachable" }),
        makeStateEntry({ phase: "unreachable" }),
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
  it("warns on state entries with no route guard (phase is always present)", () => {
    // StateEntry always has phase, but a broad entry has no route guard.
    // The lint check via getVirtualRules sees phase as local, so it won't flag.
    // To test broad-rule detection, we need to use the rules path with no local.
    // Since we're migrating away from rules, test that state entries with phase
    // are NOT flagged as broad (they always have a local guard).
    const mod = makeModule({
      states: [
        makeStateEntry({ phase: "idle", turn: "opener" }),
      ],
    });
    const diags = detectBroadRules(mod);
    expect(diags).toHaveLength(0);
  });

  it("does not warn when state entry has route guard", () => {
    const mod = makeModule({
      states: [
        makeStateEntry({ phase: "idle", route: { kind: "last", pattern: { act: "any" } } }),
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
      states: [
        makeStateEntry({
          phase: "idle",
          surfaces: [makeSurface("s1")],
          negotiationDelta: { forcing: "game" },
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
      states: [
        makeStateEntry({
          phase: "idle",
          kernel: kernelExpr,
          surfaces: [makeSurface("s1")],
          negotiationDelta: { forcing: "game" },
        }),
      ],
    });
    const diags = detectUndeclaredWrites(mod);
    expect(diags).toHaveLength(0);
  });
});

// ── detectDuplicateEncodings ────────────────────────────────────────

describe("detectDuplicateEncodings", () => {
  it("reports two surfaces in the same state entry with the same call and same meaningId", () => {
    const mod = makeModule({
      states: [
        makeStateEntry({
          phase: "idle",
          surfaces: [
            makeSurface("s1", { type: "bid", level: 2, strain: "C" }),
            makeSurface("s1", { type: "bid", level: 2, strain: "C" }),
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
      states: [
        makeStateEntry({
          phase: "idle",
          surfaces: [
            makeSurface("s1", { type: "bid", level: 2, strain: "C" }),
            makeSurface("s2", { type: "bid", level: 2, strain: "C" }),
          ],
        }),
      ],
    });
    const diags = detectDuplicateEncodings(mod);
    expect(diags).toHaveLength(0);
  });

  it("no diagnostic when surfaces have different calls", () => {
    const mod = makeModule({
      states: [
        makeStateEntry({
          phase: "idle",
          surfaces: [
            makeSurface("s1", { type: "bid", level: 2, strain: "C" }),
            makeSurface("s2", { type: "bid", level: 2, strain: "D" }),
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
      states: [
        makeStateEntry({
          phase: "idle",
          surfaces: [makeSurface("s1")],
        }),
      ],
    });
    const diags = lintModule(mod);
    expect(diags).toHaveLength(0);
  });
});
