import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createDrillPresetsStore, DRILL_PRESET_SOFT_CAP } from "../drill-presets.svelte";
import { PracticeMode, PracticeRole } from "../../service/session-types";

const STORAGE_KEY = "bridge-app:drill-presets";

function createStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
    key: (i) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
}

const baseParams = {
  name: "Stayman responder 2/1",
  conventionId: "stayman",
  practiceMode: PracticeMode.DecisionDrill,
  practiceRole: PracticeRole.Responder,
  systemSelectionId: "two-over-one" as const,
};

beforeEach(() => {
  vi.stubGlobal("localStorage", createStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("drill-presets store", () => {
  it("creates a preset and returns it with id prefix and timestamps", () => {
    const store = createDrillPresetsStore();
    const preset = store.create(baseParams);
    expect(preset.id.startsWith("drill:")).toBe(true);
    expect(preset.name).toBe("Stayman responder 2/1");
    expect(preset.lastUsedAt).toBeNull();
    expect(store.presets).toHaveLength(1);
  });

  it("persists and reloads presets from localStorage", () => {
    const a = createDrillPresetsStore();
    a.create(baseParams);
    const b = createDrillPresetsStore();
    expect(b.presets).toHaveLength(1);
    expect(b.presets[0]!.name).toBe("Stayman responder 2/1");
  });

  it("deletes a preset", () => {
    const store = createDrillPresetsStore();
    const p = store.create(baseParams);
    store.delete(p.id);
    expect(store.presets).toHaveLength(0);
  });

  it("updates a preset without changing id", () => {
    const store = createDrillPresetsStore();
    const p = store.create(baseParams);
    store.update(p.id, { name: "renamed", practiceRole: PracticeRole.Opener });
    const got = store.getPreset(p.id);
    expect(got?.name).toBe("renamed");
    expect(got?.practiceRole).toBe(PracticeRole.Opener);
    expect(got?.id).toBe(p.id);
  });

  it("markLaunched sets lastUsedAt and sorts MRU", async () => {
    const store = createDrillPresetsStore();
    const a = store.create({ ...baseParams, name: "A" });
    await new Promise((r) => setTimeout(r, 5));
    const b = store.create({ ...baseParams, name: "B" });
    // B is most recent by createdAt so it sorts first
    expect(store.presets[0]!.id).toBe(b.id);
    await new Promise((r) => setTimeout(r, 5));
    store.markLaunched(a.id);
    expect(store.presets[0]!.id).toBe(a.id);
  });

  it("validates names: empty rejected, over-length rejected", () => {
    const store = createDrillPresetsStore();
    expect(store.validateName("")).not.toBeNull();
    expect(store.validateName("   ")).not.toBeNull();
    expect(store.validateName("ok")).toBeNull();
    expect(store.validateName("x".repeat(61))).not.toBeNull();
    expect(store.validateName("x".repeat(60))).toBeNull();
  });

  it("rejects malformed entries on load", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      presets: [
        { id: "not-prefixed", name: "bad", conventionId: "x", practiceMode: "decision-drill", practiceRole: "responder", systemSelectionId: "sayc", createdAt: "x", lastUsedAt: null },
        { id: "drill:ok", name: "good", conventionId: "x", practiceMode: "decision-drill", practiceRole: "responder", systemSelectionId: "sayc", createdAt: "x", lastUsedAt: null },
      ],
    }));
    const store = createDrillPresetsStore();
    expect(store.presets).toHaveLength(1);
    expect(store.presets[0]!.id).toBe("drill:ok");
  });

  it("enforces soft cap", () => {
    const store = createDrillPresetsStore();
    for (let i = 0; i < DRILL_PRESET_SOFT_CAP; i++) {
      store.create({ ...baseParams, name: `p${i}` });
    }
    expect(store.atSoftCap).toBe(true);
    expect(() => store.create({ ...baseParams, name: "overflow" })).toThrow();
  });
});
