import { describe, it, expect } from "vitest";
import type { MachineState } from "../machine-types";
import { validateMachine } from "../machine-validation";
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
