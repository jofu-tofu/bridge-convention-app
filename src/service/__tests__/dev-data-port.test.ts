import { describe, expect, it, vi } from "vitest";
import { DevDataPort, SubscriptionTier } from "../auth";
import type {
  DataPortClient,
  DrillCreatePayload,
  DrillDto,
  DrillUpdatePayload,
} from "../auth";

function makeDrill(overrides: Partial<DrillDto> = {}): DrillDto {
  return {
    id: "drill:abc12345",
    name: "Stayman",
    moduleIds: ["stayman-bundle"],
    practiceMode: "decision-drill",
    practiceRole: "auto",
    systemSelectionId: "sayc",
    opponentMode: "natural",
    playProfileId: "club-player",
    vulnerabilityDistribution: { none: 1, ours: 0, theirs: 0, both: 0 },
    showEducationalAnnotations: true,
    createdAt: "2026-04-19T00:00:00.000Z",
    updatedAt: "2026-04-19T00:00:00.000Z",
    lastUsedAt: null,
    ...overrides,
  };
}

function makePayload(): DrillCreatePayload {
  return {
    name: "Stayman",
    moduleIds: ["stayman-bundle"],
    practiceMode: "decision-drill",
    practiceRole: "auto",
    systemSelectionId: "sayc",
    opponentMode: "natural",
    playProfileId: "club-player",
    vulnerabilityDistribution: { none: 1, ours: 0, theirs: 0, both: 0 },
    showEducationalAnnotations: true,
  };
}

function devPortWithSpies(): {
  port: DevDataPort;
  spies: Record<string, ReturnType<typeof vi.fn>>;
} {
  const port = new DevDataPort(SubscriptionTier.Free);
  // Reach into the private inner client via cast — we explicitly want to verify
  // delegation, so swap each method with a spy. (Behavior, not internals.)
  const inner = (port as unknown as { inner: DataPortClient }).inner;
  const drill = makeDrill();
  const spies: Record<string, ReturnType<typeof vi.fn>> = {
    listDrills: vi.fn().mockResolvedValue([drill]),
    createDrill: vi.fn().mockResolvedValue(drill),
    updateDrill: vi.fn().mockResolvedValue(drill),
    deleteDrill: vi.fn().mockResolvedValue(undefined),
    markDrillLaunched: vi.fn().mockResolvedValue(drill),
  };
  inner.listDrills = spies.listDrills as DataPortClient["listDrills"];
  inner.createDrill = spies.createDrill as DataPortClient["createDrill"];
  inner.updateDrill = spies.updateDrill as DataPortClient["updateDrill"];
  inner.deleteDrill = spies.deleteDrill as DataPortClient["deleteDrill"];
  inner.markDrillLaunched = spies.markDrillLaunched as DataPortClient["markDrillLaunched"];
  return { port, spies };
}

describe("DevDataPort drill methods", () => {
  it("listDrills delegates to inner client", async () => {
    const { port, spies } = devPortWithSpies();
    const result = await port.listDrills();
    expect(spies.listDrills).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("drill:abc12345");
  });

  it("createDrill forwards payload to inner client", async () => {
    const { port, spies } = devPortWithSpies();
    const payload = makePayload();
    const result = await port.createDrill(payload);
    expect(spies.createDrill).toHaveBeenCalledWith(payload);
    expect(result.id).toBe("drill:abc12345");
  });

  it("updateDrill forwards id and payload to inner client", async () => {
    const { port, spies } = devPortWithSpies();
    const payload: DrillUpdatePayload = makePayload();
    await port.updateDrill("drill:xyz", payload);
    expect(spies.updateDrill).toHaveBeenCalledWith("drill:xyz", payload);
  });

  it("deleteDrill forwards id to inner client", async () => {
    const { port, spies } = devPortWithSpies();
    await port.deleteDrill("drill:xyz");
    expect(spies.deleteDrill).toHaveBeenCalledWith("drill:xyz");
  });

  it("markDrillLaunched forwards id to inner client", async () => {
    const { port, spies } = devPortWithSpies();
    const result = await port.markDrillLaunched("drill:xyz");
    expect(spies.markDrillLaunched).toHaveBeenCalledWith("drill:xyz");
    expect(result.id).toBe("drill:abc12345");
  });
});
