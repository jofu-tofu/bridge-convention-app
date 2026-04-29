import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevDataPort, DrillNotFoundError, SubscriptionTier } from "../auth";
import type { DrillCreatePayload, DrillUpdatePayload } from "../auth";

const DEV_DRILLS_KEY = "bridge-app:dev-drills";

function createStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
}

function makePayload(overrides: Partial<DrillCreatePayload> = {}): DrillCreatePayload {
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
    ...overrides,
  };
}

describe("DevDataPort drill methods (localStorage-backed)", () => {
  let port: DevDataPort;

  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
    port = new DevDataPort(SubscriptionTier.Free);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("listDrills returns [] when no drills stored", async () => {
    expect(await port.listDrills()).toEqual([]);
  });

  it("createDrill persists a new drill and returns the DTO", async () => {
    const drill = await port.createDrill(makePayload());
    expect(drill.id).toMatch(/^drill:/);
    expect(drill.name).toBe("Stayman");
    expect(drill.lastUsedAt).toBeNull();
    const stored = JSON.parse(localStorage.getItem(DEV_DRILLS_KEY) ?? "{}") as {
      drills: { id: string }[];
    };
    expect(stored.drills.map((d) => d.id)).toEqual([drill.id]);
  });

  it("createDrill respects a client-supplied id", async () => {
    const drill = await port.createDrill(makePayload({ id: "drill:explicit" }));
    expect(drill.id).toBe("drill:explicit");
  });

  it("listDrills round-trips multiple created drills", async () => {
    await port.createDrill(makePayload({ name: "A" }));
    await port.createDrill(makePayload({ name: "B" }));
    const list = await port.listDrills();
    expect(list.map((d) => d.name)).toEqual(["A", "B"]);
  });

  it("updateDrill rewrites fields and bumps updatedAt", async () => {
    const created = await port.createDrill(makePayload());
    const patch: DrillUpdatePayload = makePayload({ name: "Renamed" });
    const updated = await port.updateDrill(created.id, patch);
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe("Renamed");
    expect(updated.createdAt).toBe(created.createdAt);
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.updatedAt).getTime(),
    );
  });

  it("updateDrill rejects with DrillNotFoundError for unknown id", async () => {
    await expect(port.updateDrill("drill:missing", makePayload())).rejects.toBeInstanceOf(
      DrillNotFoundError,
    );
  });

  it("deleteDrill removes the drill", async () => {
    const created = await port.createDrill(makePayload());
    await port.deleteDrill(created.id);
    expect(await port.listDrills()).toEqual([]);
  });

  it("deleteDrill rejects with DrillNotFoundError for unknown id", async () => {
    await expect(port.deleteDrill("drill:missing")).rejects.toBeInstanceOf(DrillNotFoundError);
  });

  it("markDrillLaunched stamps lastUsedAt", async () => {
    const created = await port.createDrill(makePayload());
    const launched = await port.markDrillLaunched(created.id);
    expect(launched.lastUsedAt).not.toBeNull();
    expect(new Date(launched.lastUsedAt ?? "").getTime()).toBeGreaterThan(0);
  });

  it("markDrillLaunched rejects with DrillNotFoundError for unknown id", async () => {
    await expect(port.markDrillLaunched("drill:missing")).rejects.toBeInstanceOf(
      DrillNotFoundError,
    );
  });

  it("does not touch the anonymous drill key", async () => {
    await port.createDrill(makePayload());
    expect(localStorage.getItem("bridge-app:drills")).toBeNull();
    expect(localStorage.getItem(DEV_DRILLS_KEY)).not.toBeNull();
  });
});
