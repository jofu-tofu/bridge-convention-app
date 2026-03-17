import { describe, it, expect } from "vitest";
import type { MachineState } from "../machine-types";
import {
  validateMachine,
  validateInterruptScoping,
  validateRoleSafety,
  validateInterruptedStateWellFormedness,
  validateTerminalReachability,
  validateInterruptPathCompleteness,
} from "../machine-validation";
import { buildMachine } from "./runtime-test-helpers";

describe("validateMachine", () => {
  it("returns no diagnostics for a valid machine", () => {
    const s1: MachineState = {
      stateId: "idle",
      parentId: null,
      transitions: [
        { transitionId: "t1", match: { kind: "pass" }, target: "done" },
      ],
    };
    const s2: MachineState = {
      stateId: "done",
      parentId: null,
      transitions: [],
    };
    const machine = buildMachine([s1, s2], "idle");
    const diagnostics = validateMachine(machine);
    expect(diagnostics).toEqual([]);
  });

  it("reports transition targeting nonexistent state", () => {
    const s1: MachineState = {
      stateId: "idle",
      parentId: null,
      transitions: [
        {
          transitionId: "t1",
          match: { kind: "pass" },
          target: "nonexistent",
        },
      ],
    };
    const machine = buildMachine([s1], "idle");
    const diagnostics = validateMachine(machine);
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0]!.level).toBe("error");
    expect(diagnostics[0]!.message).toContain("nonexistent");
  });

  it("reports parentId referencing nonexistent state", () => {
    const s1: MachineState = {
      stateId: "child",
      parentId: "nonexistent-parent",
      transitions: [],
    };
    const machine = buildMachine([s1], "child");
    const diagnostics = validateMachine(machine);
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    const parentDiag = diagnostics.find((d) =>
      d.message.includes("nonexistent-parent"),
    );
    expect(parentDiag).toBeDefined();
    expect(parentDiag!.level).toBe("error");
  });

  it("reports orphan states not reachable from initial", () => {
    const s1: MachineState = {
      stateId: "start",
      parentId: null,
      transitions: [],
    };
    const orphan: MachineState = {
      stateId: "orphan",
      parentId: null,
      transitions: [],
    };
    const machine = buildMachine([s1, orphan], "start");
    const diagnostics = validateMachine(machine);
    const orphanDiag = diagnostics.find((d) => d.message.includes("orphan"));
    expect(orphanDiag).toBeDefined();
    expect(orphanDiag!.level).toBe("warn");
  });

  it("does not report child states as orphans when reachable via parentId", () => {
    const parent: MachineState = {
      stateId: "parent",
      parentId: null,
      transitions: [
        { transitionId: "t1", match: { kind: "pass" }, target: "child" },
      ],
    };
    const child: MachineState = {
      stateId: "child",
      parentId: "parent",
      transitions: [],
    };
    const machine = buildMachine([parent, child], "parent");
    const diagnostics = validateMachine(machine);
    expect(diagnostics).toEqual([]);
  });

  it("reports duplicate transition IDs within a state", () => {
    const s1: MachineState = {
      stateId: "start",
      parentId: null,
      transitions: [
        { transitionId: "t1", match: { kind: "pass" }, target: "start" },
        { transitionId: "t1", match: { kind: "any-bid" }, target: "start" },
      ],
    };
    const machine = buildMachine([s1], "start");
    const diagnostics = validateMachine(machine);
    const dupDiag = diagnostics.find((d) =>
      d.message.includes("Duplicate transition ID"),
    );
    expect(dupDiag).toBeDefined();
    expect(dupDiag!.level).toBe("warn");
  });
});

describe("validateInterruptScoping", () => {
  it("valid scoped machine passes all rules", () => {
    const root: MachineState = {
      stateId: "root",
      parentId: null,
      transitions: [
        { transitionId: "opp", match: { kind: "opponent-action" }, target: "root-interrupted" },
        { transitionId: "t1", match: { kind: "pass" }, target: "child1" },
      ],
    };
    const child1: MachineState = {
      stateId: "child1",
      parentId: "root",
      transitions: [
        { transitionId: "t2", match: { kind: "call", level: 1, strain: "NT" as any }, target: "child2" },
      ],
      allowedParentTransitions: ["opp"],
    };
    const child2: MachineState = {
      stateId: "child2",
      parentId: "root",
      transitions: [
        { transitionId: "t3", match: { kind: "pass" }, target: "child2" },
      ],
      allowedParentTransitions: ["opp"],
    };
    const rootInterrupted: MachineState = {
      stateId: "root-interrupted",
      parentId: "root",
      transitions: [
        { transitionId: "t4", match: { kind: "pass" }, target: "root-interrupted" },
      ],
      allowedParentTransitions: ["opp"],
    };

    const machine = buildMachine([root, child1, child2, rootInterrupted], "root");
    const violations = validateInterruptScoping(machine);
    expect(violations).toEqual([]);
  });

  it("Rule 1 — leaf state with opponent-action", () => {
    const root: MachineState = {
      stateId: "root",
      parentId: null,
      transitions: [
        { transitionId: "t1", match: { kind: "pass" }, target: "leaf" },
      ],
    };
    const leaf: MachineState = {
      stateId: "leaf",
      parentId: null,
      transitions: [
        { transitionId: "opp", match: { kind: "opponent-action" }, target: "somewhere" },
        { transitionId: "t2", match: { kind: "pass" }, target: "leaf" },
      ],
    };
    const somewhere: MachineState = {
      stateId: "somewhere",
      parentId: null,
      transitions: [],
    };

    const machine = buildMachine([root, leaf, somewhere], "root");
    const violations = validateInterruptScoping(machine);

    const scopeOnly = violations.filter((v) => v.rule === "scope-only");
    expect(scopeOnly).toHaveLength(1);
    expect(scopeOnly[0]!.stateId).toBe("leaf");
  });

  it("Rule 2 — opponent-action targets outside subtree", () => {
    const scope: MachineState = {
      stateId: "scope",
      parentId: null,
      transitions: [
        { transitionId: "opp", match: { kind: "opponent-action" }, target: "external" },
      ],
    };
    const child: MachineState = {
      stateId: "child",
      parentId: "scope",
      transitions: [
        { transitionId: "t1", match: { kind: "pass" }, target: "child" },
      ],
      allowedParentTransitions: ["opp"],
    };
    const external: MachineState = {
      stateId: "external",
      parentId: null,
      transitions: [],
    };

    const machine = buildMachine([scope, child, external], "scope");
    const violations = validateInterruptScoping(machine);

    const localTarget = violations.filter((v) => v.rule === "local-target");
    expect(localTarget).toHaveLength(1);
    expect(localTarget[0]!.stateId).toBe("scope");
    expect(localTarget[0]!.message).toContain("external");
  });

  it("Rule 2 — opponent-action targets descendant passes", () => {
    const scope: MachineState = {
      stateId: "scope",
      parentId: null,
      transitions: [
        { transitionId: "opp", match: { kind: "opponent-action" }, target: "scope-interrupted" },
      ],
    };
    const child: MachineState = {
      stateId: "child",
      parentId: "scope",
      transitions: [
        { transitionId: "t1", match: { kind: "pass" }, target: "child" },
      ],
    };
    const scopeInterrupted: MachineState = {
      stateId: "scope-interrupted",
      parentId: "scope",
      transitions: [],
    };

    const machine = buildMachine([scope, child, scopeInterrupted], "scope");
    const violations = validateInterruptScoping(machine);
    expect(violations).toEqual([]);
  });

  it("Rule 3 — state with no ancestor interrupt handler", () => {
    const root: MachineState = {
      stateId: "root",
      parentId: null,
      transitions: [
        { transitionId: "t1", match: { kind: "pass" }, target: "orphan" },
      ],
    };
    const orphan: MachineState = {
      stateId: "orphan",
      parentId: null,
      transitions: [
        { transitionId: "t2", match: { kind: "pass" }, target: "orphan" },
      ],
    };

    const machine = buildMachine([root, orphan], "root");
    const violations = validateInterruptScoping(machine);

    const coverage = violations.filter((v) => v.rule === "coverage");
    expect(coverage).toHaveLength(1);
    expect(coverage[0]!.stateId).toBe("orphan");
  });

  it("Rule 3 — terminal state is exempt", () => {
    const root: MachineState = {
      stateId: "root",
      parentId: null,
      transitions: [
        { transitionId: "opp", match: { kind: "opponent-action" }, target: "interrupted" },
        { transitionId: "t1", match: { kind: "pass" }, target: "terminal" },
      ],
    };
    const terminal: MachineState = {
      stateId: "terminal",
      parentId: null,
      transitions: [],
    };
    const interrupted: MachineState = {
      stateId: "interrupted",
      parentId: "root",
      transitions: [],
    };

    const machine = buildMachine([root, terminal, interrupted], "root");
    const violations = validateInterruptScoping(machine);

    const coverage = violations.filter((v) => v.rule === "coverage");
    expect(coverage).toHaveLength(0);
  });

  it("multi-level scoping passes", () => {
    const root: MachineState = {
      stateId: "root",
      parentId: null,
      transitions: [
        { transitionId: "root-opp", match: { kind: "opponent-action" }, target: "root-int" },
        { transitionId: "t1", match: { kind: "pass" }, target: "mid" },
      ],
    };
    const mid: MachineState = {
      stateId: "mid",
      parentId: "root",
      transitions: [
        { transitionId: "mid-opp", match: { kind: "opponent-action" }, target: "mid-int" },
        { transitionId: "t2", match: { kind: "pass" }, target: "leaf" },
      ],
    };
    const leaf: MachineState = {
      stateId: "leaf",
      parentId: "mid",
      transitions: [
        { transitionId: "t3", match: { kind: "pass" }, target: "leaf" },
      ],
      allowedParentTransitions: ["mid-opp"],
    };
    const rootInt: MachineState = {
      stateId: "root-int",
      parentId: "root",
      transitions: [],
    };
    const midInt: MachineState = {
      stateId: "mid-int",
      parentId: "mid",
      transitions: [],
    };

    const machine = buildMachine([root, mid, leaf, rootInt, midInt], "root");
    const violations = validateInterruptScoping(machine);
    expect(violations).toEqual([]);
  });
});

describe("validateRoleSafety", () => {
  it("no violations when transitions have no allowedRoles", () => {
    const s1: MachineState = {
      stateId: "idle",
      parentId: null,
      transitions: [
        { transitionId: "t1", match: { kind: "call", level: 1, strain: "C" as any }, target: "done" },
      ],
    };
    const s2: MachineState = {
      stateId: "done",
      parentId: null,
      transitions: [],
    };
    const machine = buildMachine([s1, s2], "idle");
    expect(validateRoleSafety(machine)).toEqual([]);
  });

  it("no violations when call transition has allowedRoles: ['self', 'partner']", () => {
    const s1: MachineState = {
      stateId: "idle",
      parentId: null,
      transitions: [
        {
          transitionId: "t1",
          match: { kind: "call", level: 1, strain: "C" as any },
          target: "done",
          allowedRoles: ["self", "partner"],
        },
      ],
    };
    const s2: MachineState = {
      stateId: "done",
      parentId: null,
      transitions: [],
    };
    const machine = buildMachine([s1, s2], "idle");
    expect(validateRoleSafety(machine)).toEqual([]);
  });

  it("violation when call transition has allowedRoles including 'opponent'", () => {
    const s1: MachineState = {
      stateId: "idle",
      parentId: null,
      transitions: [
        {
          transitionId: "t1",
          match: { kind: "call", level: 1, strain: "C" as any },
          target: "done",
          allowedRoles: ["opponent"],
        },
      ],
    };
    const s2: MachineState = {
      stateId: "done",
      parentId: null,
      transitions: [],
    };
    const machine = buildMachine([s1, s2], "idle");
    const violations = validateRoleSafety(machine);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.stateId).toBe("idle");
    expect(violations[0]!.transitionId).toBe("t1");
    expect(violations[0]!.message).toContain("opponent");
  });

  it("violation when any-bid transition has allowedRoles including 'opponent'", () => {
    const s1: MachineState = {
      stateId: "idle",
      parentId: null,
      transitions: [
        {
          transitionId: "t1",
          match: { kind: "any-bid" },
          target: "done",
          allowedRoles: ["self", "opponent"],
        },
      ],
    };
    const s2: MachineState = {
      stateId: "done",
      parentId: null,
      transitions: [],
    };
    const machine = buildMachine([s1, s2], "idle");
    const violations = validateRoleSafety(machine);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.stateId).toBe("idle");
    expect(violations[0]!.message).toContain("any-bid");
  });
});

describe("validateInterruptedStateWellFormedness", () => {
  it("no violations for well-formed interrupted state", () => {
    const scope: MachineState = {
      stateId: "scope",
      parentId: null,
      transitions: [
        { transitionId: "opp", match: { kind: "opponent-action" }, target: "interrupted" },
        { transitionId: "t1", match: { kind: "pass" }, target: "done" },
      ],
    };
    const interrupted: MachineState = {
      stateId: "interrupted",
      parentId: "scope",
      surfaceGroupId: "competition-surfaces",
      entryEffects: { setCompetitionMode: "overcall" },
      transitions: [
        { transitionId: "t2", match: { kind: "pass" }, target: "done" },
      ],
    };
    const done: MachineState = {
      stateId: "done",
      parentId: null,
      transitions: [],
    };
    const machine = buildMachine([scope, interrupted, done], "scope");
    expect(validateInterruptedStateWellFormedness(machine)).toEqual([]);
  });

  it("violation when interrupted state is missing surfaceGroupId", () => {
    const scope: MachineState = {
      stateId: "scope",
      parentId: null,
      transitions: [
        { transitionId: "opp", match: { kind: "opponent-action" }, target: "interrupted" },
      ],
    };
    const interrupted: MachineState = {
      stateId: "interrupted",
      parentId: "scope",
      entryEffects: { setCompetitionMode: "overcall" },
      transitions: [
        { transitionId: "t1", match: { kind: "pass" }, target: "interrupted" },
      ],
    };
    const machine = buildMachine([scope, interrupted], "scope");
    const violations = validateInterruptedStateWellFormedness(machine);
    const surfaceViolations = violations.filter((v) => v.rule === "missing-surface");
    expect(surfaceViolations).toHaveLength(1);
    expect(surfaceViolations[0]!.stateId).toBe("interrupted");
  });

  it("violation when interrupted state is missing setCompetitionMode", () => {
    const scope: MachineState = {
      stateId: "scope",
      parentId: null,
      transitions: [
        { transitionId: "opp", match: { kind: "opponent-action" }, target: "interrupted" },
      ],
    };
    const interrupted: MachineState = {
      stateId: "interrupted",
      parentId: "scope",
      surfaceGroupId: "competition-surfaces",
      transitions: [
        { transitionId: "t1", match: { kind: "pass" }, target: "interrupted" },
      ],
    };
    const machine = buildMachine([scope, interrupted], "scope");
    const violations = validateInterruptedStateWellFormedness(machine);
    const modeViolations = violations.filter((v) => v.rule === "missing-competition-mode");
    expect(modeViolations).toHaveLength(1);
    expect(modeViolations[0]!.stateId).toBe("interrupted");
  });

  it("violation when interrupted state is missing pass handler", () => {
    const scope: MachineState = {
      stateId: "scope",
      parentId: null,
      transitions: [
        { transitionId: "opp", match: { kind: "opponent-action" }, target: "interrupted" },
      ],
    };
    const interrupted: MachineState = {
      stateId: "interrupted",
      parentId: "scope",
      surfaceGroupId: "competition-surfaces",
      entryEffects: { setCompetitionMode: "overcall" },
      transitions: [
        { transitionId: "t1", match: { kind: "any-bid" }, target: "scope" },
      ],
    };
    const machine = buildMachine([scope, interrupted], "scope");
    const violations = validateInterruptedStateWellFormedness(machine);
    const passViolations = violations.filter((v) => v.rule === "missing-pass-handler");
    expect(passViolations).toHaveLength(1);
    expect(passViolations[0]!.stateId).toBe("interrupted");
  });
});

describe("validateTerminalReachability", () => {
  it("no violations for simple linear machine", () => {
    const idle: MachineState = {
      stateId: "idle",
      parentId: null,
      transitions: [
        { transitionId: "t1", match: { kind: "pass" }, target: "active" },
      ],
    };
    const active: MachineState = {
      stateId: "active",
      parentId: null,
      transitions: [
        { transitionId: "t2", match: { kind: "pass" }, target: "done" },
      ],
    };
    const done: MachineState = {
      stateId: "done",
      parentId: null,
      transitions: [],
    };
    const machine = buildMachine([idle, active, done], "idle");
    expect(validateTerminalReachability(machine)).toEqual([]);
  });

  it("violation for cycle between two states with no path to terminal", () => {
    const idle: MachineState = {
      stateId: "idle",
      parentId: null,
      transitions: [
        { transitionId: "t1", match: { kind: "pass" }, target: "a" },
      ],
    };
    const a: MachineState = {
      stateId: "a",
      parentId: null,
      transitions: [
        { transitionId: "t2", match: { kind: "pass" }, target: "b" },
      ],
    };
    const b: MachineState = {
      stateId: "b",
      parentId: null,
      transitions: [
        { transitionId: "t3", match: { kind: "pass" }, target: "a" },
      ],
    };
    const machine = buildMachine([idle, a, b], "idle");
    const violations = validateTerminalReachability(machine);
    // "a" and "b" form a cycle with no path to terminal.
    expect(violations.length).toBeGreaterThanOrEqual(2);
    expect(violations.find((v) => v.stateId === "a")).toBeDefined();
    expect(violations.find((v) => v.stateId === "b")).toBeDefined();
  });

  it("no violations when all states can reach terminal", () => {
    const scope: MachineState = {
      stateId: "scope",
      parentId: null,
      transitions: [
        { transitionId: "t1", match: { kind: "pass" }, target: "child" },
      ],
    };
    const child: MachineState = {
      stateId: "child",
      parentId: "scope",
      transitions: [
        { transitionId: "t2", match: { kind: "pass" }, target: "terminal" },
        { transitionId: "t3", match: { kind: "any-bid" }, target: "child" },
      ],
    };
    const terminal: MachineState = {
      stateId: "terminal",
      parentId: null,
      transitions: [],
    };
    const machine = buildMachine([scope, child, terminal], "scope");
    expect(validateTerminalReachability(machine)).toEqual([]);
  });

  it("handles submachineRef as edge to returnTarget", () => {
    const idle: MachineState = {
      stateId: "idle",
      parentId: null,
      transitions: [
        { transitionId: "t1", match: { kind: "pass" }, target: "invoke" },
      ],
    };
    const invoke: MachineState = {
      stateId: "invoke",
      parentId: null,
      transitions: [],
      submachineRef: { machineId: "sub", returnTarget: "done" },
    };
    const done: MachineState = {
      stateId: "done",
      parentId: null,
      transitions: [],
    };
    const machine = buildMachine([idle, invoke, done], "idle");
    expect(validateTerminalReachability(machine)).toEqual([]);
  });
});

describe("validateInterruptPathCompleteness", () => {
  it("no violations with catch-all opponent-action (no callType)", () => {
    const scope: MachineState = {
      stateId: "scope",
      parentId: null,
      transitions: [
        { transitionId: "opp", match: { kind: "opponent-action" }, target: "interrupted" },
        { transitionId: "t1", match: { kind: "pass" }, target: "done" },
      ],
    };
    const interrupted: MachineState = {
      stateId: "interrupted",
      parentId: "scope",
      transitions: [],
    };
    const done: MachineState = {
      stateId: "done",
      parentId: null,
      transitions: [],
    };
    const machine = buildMachine([scope, interrupted, done], "scope");
    expect(validateInterruptPathCompleteness(machine)).toEqual([]);
  });

  it("violation when only callType 'double' is covered (missing 'bid')", () => {
    const idle: MachineState = { stateId: "idle", parentId: null, transitions: [
      { transitionId: "t0", match: { kind: "pass" }, target: "scope" },
    ]};
    const scope: MachineState = {
      stateId: "scope",
      parentId: null,
      transitions: [
        {
          transitionId: "opp-dbl",
          match: { kind: "opponent-action", callType: "double" },
          target: "doubled",
        },
        { transitionId: "t1", match: { kind: "pass" }, target: "done" },
      ],
    };
    const doubled: MachineState = { stateId: "doubled", parentId: "scope", transitions: [] };
    const done: MachineState = { stateId: "done", parentId: null, transitions: [] };
    const machine = buildMachine([idle, scope, doubled, done], "idle");
    const violations = validateInterruptPathCompleteness(machine);
    const bidViolation = violations.find((v) => v.actionType === "bid");
    expect(bidViolation).toBeDefined();
    expect(bidViolation!.stateId).toBe("scope");
  });

  it("no violations when both 'double' and 'bid' are covered", () => {
    const idle: MachineState = { stateId: "idle", parentId: null, transitions: [
      { transitionId: "t0", match: { kind: "pass" }, target: "scope" },
    ]};
    const scope: MachineState = {
      stateId: "scope",
      parentId: null,
      transitions: [
        { transitionId: "opp-dbl", match: { kind: "opponent-action", callType: "double" }, target: "doubled" },
        { transitionId: "opp-bid", match: { kind: "opponent-action", callType: "bid" }, target: "overcalled" },
        { transitionId: "opp-rdbl", match: { kind: "opponent-action", callType: "redouble" }, target: "redoubled" },
        { transitionId: "t1", match: { kind: "pass" }, target: "done" },
      ],
    };
    const doubled: MachineState = { stateId: "doubled", parentId: "scope", transitions: [] };
    const overcalled: MachineState = { stateId: "overcalled", parentId: "scope", transitions: [] };
    const redoubled: MachineState = { stateId: "redoubled", parentId: "scope", transitions: [] };
    const done: MachineState = { stateId: "done", parentId: null, transitions: [] };
    const machine = buildMachine([idle, scope, doubled, overcalled, redoubled, done], "idle");
    expect(validateInterruptPathCompleteness(machine)).toEqual([]);
  });

  it("redouble warning when double and bid are covered but not redouble", () => {
    const idle: MachineState = { stateId: "idle", parentId: null, transitions: [
      { transitionId: "t0", match: { kind: "pass" }, target: "scope" },
    ]};
    const scope: MachineState = {
      stateId: "scope",
      parentId: null,
      transitions: [
        { transitionId: "opp-dbl", match: { kind: "opponent-action", callType: "double" }, target: "doubled" },
        { transitionId: "opp-bid", match: { kind: "opponent-action", callType: "bid" }, target: "overcalled" },
        { transitionId: "t1", match: { kind: "pass" }, target: "done" },
      ],
    };
    const doubled: MachineState = { stateId: "doubled", parentId: "scope", transitions: [] };
    const overcalled: MachineState = { stateId: "overcalled", parentId: "scope", transitions: [] };
    const done: MachineState = { stateId: "done", parentId: null, transitions: [] };
    const machine = buildMachine([idle, scope, doubled, overcalled, done], "idle");
    const violations = validateInterruptPathCompleteness(machine);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.actionType).toBe("redouble");
    expect(violations[0]!.stateId).toBe("scope");
  });
});
