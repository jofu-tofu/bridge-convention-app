import { describe, it, expect } from "vitest";
import { emitDecisionSurfaces } from "../decision-surface-emitter";
import { buildSnapshotFromAuction } from "../public-snapshot-builder";
import { buildAuction } from "../../../../engine/auction-helpers";
import { Seat } from "../../../../engine/types";
import type { RuntimeModule } from "../types";
import type { MeaningSurface } from "../../../../core/contracts/meaning-surface";
import { makeSurface } from "./runtime-test-helpers";

function makeModule(
  id: string,
  active: boolean,
  surfaces: MeaningSurface[] = [],
): RuntimeModule {
  return {
    id,
    capabilities: [],
    isActive: () => active,
    emitSurfaces: () => surfaces,
  };
}

describe("emitDecisionSurfaces", () => {
  const auction = buildAuction(Seat.North, ["1NT", "P"]);
  const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

  it("emits surfaces from an active module", () => {
    const surface = makeSurface("test:meaning", "mod-a");
    const mod = makeModule("mod-a", true, [surface]);

    const { entries, diagnostics } = emitDecisionSurfaces(
      [mod],
      snapshot,
      auction,
      Seat.South,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]!.moduleId).toBe("mod-a");
    expect(entries[0]!.surfaces).toEqual([surface]);
    expect(diagnostics).toHaveLength(0);
  });

  it("skips inactive modules", () => {
    const mod = makeModule("mod-b", false, [
      makeSurface("test:meaning", "mod-b"),
    ]);

    const { entries } = emitDecisionSurfaces(
      [mod],
      snapshot,
      auction,
      Seat.South,
    );

    expect(entries).toHaveLength(0);
  });

  it("emits diagnostic warning when active module produces no surfaces", () => {
    const mod = makeModule("mod-c", true, []);

    const { entries, diagnostics } = emitDecisionSurfaces(
      [mod],
      snapshot,
      auction,
      Seat.South,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]!.surfaces).toHaveLength(0);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.level).toBe("warn");
    expect(diagnostics[0]!.moduleId).toBe("mod-c");
    expect(diagnostics[0]!.message).toContain("mod-c");
    expect(diagnostics[0]!.message).toContain("no surfaces");
  });

  it("collects surfaces from multiple active modules", () => {
    const surfaceA = makeSurface("a:meaning", "mod-a");
    const surfaceB = makeSurface("b:meaning", "mod-b");
    const modA = makeModule("mod-a", true, [surfaceA]);
    const modB = makeModule("mod-b", true, [surfaceB]);
    const modC = makeModule("mod-c", false);

    const { entries } = emitDecisionSurfaces(
      [modA, modB, modC],
      snapshot,
      auction,
      Seat.South,
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]!.moduleId).toBe("mod-a");
    expect(entries[1]!.moduleId).toBe("mod-b");
  });
});
