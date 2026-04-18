import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PracticeMode, PracticeRole } from "../../service";
import { setWasmModule } from "../../service/service-helpers";
import { createDrillsStore, DRILL_NAME_MAX } from "../drills.svelte";

const STORAGE_KEY = "bridge-app:drills";
const LEGACY_PRESETS_KEY = "bridge-app:drill-presets";
const LEGACY_CUSTOM_DRILLS_KEY = "bridge-app:custom-drills";
const LEGACY_PACKS_KEY = "bridge-app:practice-packs";

class TestWasmServicePort {
  list_conventions() {
    return [
      { id: "stayman-bundle" },
      { id: "jacoby-transfers-bundle" },
      { id: "nt-bundle" },
    ];
  }

  list_modules() {
    return [
      { moduleId: "stayman" },
      { moduleId: "jacoby-transfers" },
      { moduleId: "blackwood" },
    ];
  }

  get_module_learning_viewport() {
    return null;
  }

  get_module_flow_tree() {
    return null;
  }
}

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

function pause(ms = 5): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

beforeEach(() => {
  setWasmModule({ WasmServicePort: TestWasmServicePort }, new TestWasmServicePort());
  vi.stubGlobal("localStorage", createStorage());
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("drills store", () => {
  it("supports create, update, rename, markLaunched, and delete", () => {
    const store = createDrillsStore({ defaultSystemId: "sayc" });

    const created = store.create({
      name: " Stayman practice ",
      moduleIds: ["nt-stayman"],
      practiceMode: PracticeMode.DecisionDrill,
      practiceRole: PracticeRole.Responder,
      systemSelectionId: "sayc",
    });

    expect(created.id.startsWith("drill:")).toBe(true);
    expect(created.name).toBe("Stayman practice");
    expect(created.moduleIds).toEqual(["stayman-bundle"]);

    store.update(created.id, {
      name: "Transfers practice",
      moduleIds: ["nt-transfers"],
      practiceMode: PracticeMode.FullAuction,
      practiceRole: "auto",
      systemSelectionId: "two-over-one",
    });

    const updated = store.getById(created.id);
    expect(updated).toMatchObject({
      id: created.id,
      name: "Transfers practice",
      moduleIds: ["jacoby-transfers-bundle"],
      practiceMode: PracticeMode.FullAuction,
      practiceRole: "auto",
      systemSelectionId: "two-over-one",
    });

    store.rename(created.id, "  Renamed drill  ");
    expect(store.getById(created.id)?.name).toBe("Renamed drill");

    store.markLaunched(created.id);
    expect(store.getById(created.id)?.lastUsedAt).not.toBeNull();

    store.delete(created.id);
    expect(store.list()).toHaveLength(0);
  });

  it("sorts by lastUsedAt desc with nulls last and updatedAt as tiebreaker", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        drills: [
          {
            id: "drill:null-older",
            name: "Null older",
            moduleIds: ["stayman-bundle"],
            practiceMode: PracticeMode.DecisionDrill,
            practiceRole: PracticeRole.Responder,
            systemSelectionId: "sayc",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
            lastUsedAt: null,
          },
          {
            id: "drill:used-latest",
            name: "Used latest",
            moduleIds: ["stayman-bundle"],
            practiceMode: PracticeMode.DecisionDrill,
            practiceRole: PracticeRole.Responder,
            systemSelectionId: "sayc",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
            lastUsedAt: "2026-04-04T00:00:00.000Z",
          },
          {
            id: "drill:used-earlier",
            name: "Used earlier",
            moduleIds: ["stayman-bundle"],
            practiceMode: PracticeMode.DecisionDrill,
            practiceRole: PracticeRole.Responder,
            systemSelectionId: "sayc",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
            lastUsedAt: "2026-04-03T00:00:00.000Z",
          },
          {
            id: "drill:null-newer",
            name: "Null newer",
            moduleIds: ["stayman-bundle"],
            practiceMode: PracticeMode.DecisionDrill,
            practiceRole: PracticeRole.Responder,
            systemSelectionId: "sayc",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-02T00:00:00.000Z",
            lastUsedAt: null,
          },
        ],
      }),
    );

    const store = createDrillsStore({ defaultSystemId: "sayc" });

    expect(store.list().map((drill) => drill.id)).toEqual([
      "drill:used-latest",
      "drill:used-earlier",
      "drill:null-newer",
      "drill:null-older",
    ]);
  });

  it("validates trimmed names, rejects empty names, and enforces the max length", () => {
    const store = createDrillsStore({ defaultSystemId: "sayc" });

    expect(store.validateName("")).toBe("Name is required");
    expect(store.validateName("   ")).toBe("Name is required");
    expect(store.validateName("  Good name  ")).toBeNull();
    expect(store.validateName("x".repeat(DRILL_NAME_MAX + 1))).toBe(
      `Name must be ${DRILL_NAME_MAX} characters or fewer`,
    );
  });

  it("markLaunched updates lastUsedAt and moves the drill to the front", async () => {
    const store = createDrillsStore({ defaultSystemId: "sayc" });
    const first = store.create({
      name: "First",
      moduleIds: ["stayman-bundle"],
      practiceMode: PracticeMode.DecisionDrill,
      practiceRole: PracticeRole.Responder,
      systemSelectionId: "sayc",
    });
    await pause();
    const second = store.create({
      name: "Second",
      moduleIds: ["jacoby-transfers-bundle"],
      practiceMode: PracticeMode.DecisionDrill,
      practiceRole: PracticeRole.Responder,
      systemSelectionId: "sayc",
    });

    expect(store.list()[0]?.id).toBe(second.id);

    await pause();
    store.markLaunched(first.id);

    expect(store.list()[0]?.id).toBe(first.id);
    expect(store.getById(first.id)?.lastUsedAt).not.toBeNull();
  });

  it("migrates legacy presets, custom drills, and packs while skipping malformed records", () => {
    const presetBlob = JSON.stringify({
      presets: [
        {
          id: "drill:stayman",
          name: " Stayman responder ",
          conventionId: "nt-stayman",
          practiceMode: PracticeMode.DecisionDrill,
          practiceRole: PracticeRole.Responder,
          systemSelectionId: "sayc",
          createdAt: "2026-04-01T00:00:00.000Z",
          lastUsedAt: "2026-04-10T00:00:00.000Z",
        },
        {
          id: "wrong-prefix",
          name: "Bad preset",
          conventionId: "stayman-bundle",
          practiceMode: PracticeMode.DecisionDrill,
          practiceRole: PracticeRole.Responder,
          systemSelectionId: "sayc",
          createdAt: "2026-04-01T00:00:00.000Z",
          lastUsedAt: null,
        },
      ],
    });
    const customBlob = JSON.stringify({
      drills: [
        {
          id: "custom-drill:transfers",
          name: " Transfers opener ",
          conventionId: "nt-transfers",
          practiceRole: PracticeRole.Opener,
          systemSelectionId: "two-over-one",
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-03T00:00:00.000Z",
        },
        {
          id: "drill:bad-custom",
          name: "Bad custom",
          conventionId: "stayman-bundle",
          practiceRole: PracticeRole.Opener,
          systemSelectionId: "sayc",
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-03T00:00:00.000Z",
        },
      ],
    });
    const packBlob = JSON.stringify({
      packs: [
        {
          id: "practice-pack:mixed",
          name: " Mixed practice ",
          conventionIds: ["stayman", "missing-module", "user:custom-module"],
          createdAt: "2026-04-04T00:00:00.000Z",
          updatedAt: "2026-04-05T00:00:00.000Z",
        },
        {
          id: "practice-pack:unknown-only",
          name: "Unknown only",
          conventionIds: ["missing-a", "missing-b"],
          createdAt: "2026-04-04T00:00:00.000Z",
          updatedAt: "2026-04-05T00:00:00.000Z",
        },
        {
          id: "broken-pack",
          name: "Broken pack",
          conventionIds: "stayman",
          createdAt: "2026-04-04T00:00:00.000Z",
          updatedAt: "2026-04-05T00:00:00.000Z",
        },
      ],
    });

    localStorage.setItem(LEGACY_PRESETS_KEY, presetBlob);
    localStorage.setItem(LEGACY_CUSTOM_DRILLS_KEY, customBlob);
    localStorage.setItem(LEGACY_PACKS_KEY, packBlob);

    const store = createDrillsStore({ defaultSystemId: "sayc" });

    expect(store.migrationSkipped).toBe(4);
    expect(console.warn).toHaveBeenCalledTimes(4);
    expect(store.list()).toHaveLength(3);
    expect(store.list().map((drill) => drill.id)).toEqual([
      "drill:preset-stayman",
      "drill:pack-mixed",
      "drill:custom-transfers",
    ]);
    expect(store.getById("drill:preset-stayman")).toMatchObject({
      moduleIds: ["stayman-bundle"],
      name: "Stayman responder",
      practiceMode: PracticeMode.DecisionDrill,
      practiceRole: PracticeRole.Responder,
      systemSelectionId: "sayc",
      lastUsedAt: "2026-04-10T00:00:00.000Z",
    });
    expect(store.getById("drill:custom-transfers")).toMatchObject({
      moduleIds: ["jacoby-transfers-bundle"],
      name: "Transfers opener",
      practiceMode: PracticeMode.DecisionDrill,
      practiceRole: PracticeRole.Opener,
      systemSelectionId: "two-over-one",
      lastUsedAt: null,
    });
    expect(store.getById("drill:pack-mixed")).toMatchObject({
      moduleIds: ["stayman", "user:custom-module"],
      name: "Mixed practice",
      practiceMode: PracticeMode.DecisionDrill,
      practiceRole: "auto",
      systemSelectionId: "sayc",
      lastUsedAt: null,
    });

    expect(localStorage.getItem(LEGACY_PRESETS_KEY)).toBe(presetBlob);
    expect(localStorage.getItem(LEGACY_CUSTOM_DRILLS_KEY)).toBe(customBlob);
    expect(localStorage.getItem(LEGACY_PACKS_KEY)).toBe(packBlob);
  });
});
