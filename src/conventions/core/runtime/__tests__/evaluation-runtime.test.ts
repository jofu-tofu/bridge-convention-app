import { describe, it, expect } from "vitest";
import { evaluate } from "../evaluation-runtime";
import { buildAuction } from "../../../../engine/auction-helpers";
import { Seat, BidSuit } from "../../../../engine/types";
import type { RuntimeModule } from "../types";
import { makeSurface, buildMachine } from "./runtime-test-helpers";

describe("evaluate", () => {
  it("produces snapshot and surfaces from two active modules", () => {
    const modA: RuntimeModule = {
      id: "mod-a",
      capabilities: ["cap-1"],
      isActive: () => true,
      emitSurfaces: () => [makeSurface("a:bid", "mod-a")],
    };
    const modB: RuntimeModule = {
      id: "mod-b",
      capabilities: ["cap-2"],
      isActive: () => true,
      emitSurfaces: () => [makeSurface("b:bid", "mod-b")],
    };

    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = evaluate(
      [modA, modB],
      auction,
      Seat.South,
      ["mod-a", "mod-b"],
    );

    expect(result.publicSnapshot.activeModuleIds).toEqual([
      "mod-a",
      "mod-b",
    ]);
    expect(result.decisionSurfaces).toHaveLength(2);
    expect(result.decisionSurfaces[0]!.moduleId).toBe("mod-a");
    expect(result.decisionSurfaces[1]!.moduleId).toBe("mod-b");
    expect(result.diagnostics).toHaveLength(0);
  });

  it("produces empty surfaces and diagnostics with no modules", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = evaluate([], auction, Seat.South, []);

    expect(result.publicSnapshot.activeModuleIds).toEqual([]);
    expect(result.decisionSurfaces).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("includes diagnostic when active module emits no surfaces", () => {
    const mod: RuntimeModule = {
      id: "empty-mod",
      capabilities: [],
      isActive: () => true,
      emitSurfaces: () => [],
    };

    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = evaluate([mod], auction, Seat.South, ["empty-mod"]);

    expect(result.decisionSurfaces).toHaveLength(1);
    expect(result.decisionSurfaces[0]!.surfaces).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.level).toBe("warn");
    expect(result.diagnostics[0]!.moduleId).toBe("empty-mod");
  });

  it("with machine: filters modules by activeSurfaceGroupIds", () => {
    // Build a minimal machine: idle → active-state on 1NT
    // active-state has surfaceGroupId "group-a"
    const machine = buildMachine([
      {
        stateId: "idle",
        parentId: null,
        transitions: [
          { transitionId: "t1", match: { kind: "call", level: 1, strain: BidSuit.NoTrump }, target: "active-state" },
        ],
      },
      {
        stateId: "active-state",
        parentId: null,
        surfaceGroupId: "group-a",
        transitions: [],
      },
    ], "idle");

    const modA: RuntimeModule = {
      id: "group-a",
      capabilities: [],
      isActive: () => true,
      emitSurfaces: () => [makeSurface("a:bid", "group-a")],
    };
    const modB: RuntimeModule = {
      id: "group-b",
      capabilities: [],
      isActive: () => true,
      emitSurfaces: () => [makeSurface("b:bid", "group-b")],
    };

    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = evaluate(
      [modA, modB],
      auction,
      Seat.South,
      ["group-a", "group-b"],
      { machine },
    );

    // Only modA should emit because machine's activeSurfaceGroupIds = ["group-a"]
    expect(result.decisionSurfaces).toHaveLength(1);
    expect(result.decisionSurfaces[0]!.moduleId).toBe("group-a");
  });

  it("with machine: machine registers flow into snapshot", () => {
    const machine = buildMachine([
      {
        stateId: "idle",
        parentId: null,
        transitions: [
          { transitionId: "t1", match: { kind: "call", level: 1, strain: BidSuit.NoTrump }, target: "forcing-state" },
        ],
      },
      {
        stateId: "forcing-state",
        parentId: null,
        surfaceGroupId: "responder-r1",
        transitions: [],
        entryEffects: { setCaptain: "opener" },
      },
    ], "idle");

    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = evaluate(
      [],
      auction,
      Seat.South,
      [],
      { machine },
    );

    expect(result.publicSnapshot.captain).toBe("opener");
  });

  it("with machine: machine diagnostics merge with emitter diagnostics", () => {
    // Use a machine that produces no diagnostics (clean transition)
    // and a module that emits empty surfaces (produces a warning diagnostic)
    const machine = buildMachine([
      {
        stateId: "idle",
        parentId: null,
        transitions: [
          { transitionId: "t1", match: { kind: "call", level: 1, strain: BidSuit.NoTrump }, target: "active" },
        ],
      },
      {
        stateId: "active",
        parentId: null,
        surfaceGroupId: "empty-group",
        transitions: [],
      },
    ], "idle");

    const emptyMod: RuntimeModule = {
      id: "empty-group",
      capabilities: [],
      isActive: () => true,
      emitSurfaces: () => [],
    };

    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = evaluate(
      [emptyMod],
      auction,
      Seat.South,
      ["empty-group"],
      { machine },
    );

    // Emitter diagnostic for empty surfaces should be present
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(result.diagnostics.some(d => d.level === "warn")).toBe(true);
  });

  it("with machine: no matching modules produces no surfaces", () => {
    const machine = buildMachine([
      {
        stateId: "idle",
        parentId: null,
        transitions: [
          { transitionId: "t1", match: { kind: "call", level: 1, strain: BidSuit.NoTrump }, target: "active" },
        ],
      },
      {
        stateId: "active",
        parentId: null,
        surfaceGroupId: "nonexistent-group",
        transitions: [],
      },
    ], "idle");

    const mod: RuntimeModule = {
      id: "some-other-group",
      capabilities: [],
      isActive: () => true,
      emitSurfaces: () => [makeSurface("x:bid", "some-other-group")],
    };

    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = evaluate(
      [mod],
      auction,
      Seat.South,
      ["some-other-group"],
      { machine },
    );

    expect(result.decisionSurfaces).toHaveLength(0);
  });
});
