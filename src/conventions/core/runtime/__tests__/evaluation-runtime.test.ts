import { describe, it, expect } from "vitest";
import { evaluate } from "../evaluation-runtime";
import { buildAuction } from "../../../../engine/auction-helpers";
import { Seat } from "../../../../engine/types";
import type { RuntimeModule } from "../types";
import { makeSurface } from "./runtime-test-helpers";

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
});
