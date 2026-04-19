import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpponentMode, PracticeMode, PracticeRole } from "../../service";
import type {
  AuthUser,
  DataPort,
  DrillCreatePayload,
  DrillDto,
  DrillUpdatePayload,
} from "../../service";
import {
  DrillEntitlementError,
  DrillUnknownModuleError,
  SubscriptionTier,
} from "../../service";
import { setWasmModule } from "../../service/service-helpers";
import { createDrillsStore } from "../drills.svelte";
import { TEST_DRILL_SEED, TEST_DRILL_TUNABLES } from "../../test-support/fixtures";

const STORAGE_KEY = "bridge-app:drills";
const LEGACY_PRESETS_KEY = "bridge-app:drill-presets";

class TestWasmServicePort {
  list_conventions() {
    return [
      { id: "stayman-bundle" },
      { id: "jacoby-transfers-bundle" },
      { id: "bergen-bundle" },
    ];
  }
  list_modules() {
    return [{ moduleId: "stayman" }, { moduleId: "jacoby-transfers" }];
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

function fakeUser(): AuthUser {
  return {
    id: "user-1",
    display_name: "User One",
    email: "u1@example.com",
    avatar_url: null,
    created_at: "2026-04-19T00:00:00.000Z",
    updated_at: "2026-04-19T00:00:00.000Z",
    subscription_tier: SubscriptionTier.Free,
    subscription_current_period_end: null,
  };
}

function fakeDto(overrides: Partial<DrillDto> = {}): DrillDto {
  return {
    id: "drill:server01",
    name: "Server Stayman",
    moduleIds: ["stayman-bundle"],
    practiceMode: PracticeMode.DecisionDrill,
    practiceRole: PracticeRole.Responder,
    systemSelectionId: "sayc",
    opponentMode: OpponentMode.Natural,
    playProfileId: "club-player",
    vulnerabilityDistribution: { none: 1, ours: 0, theirs: 0, both: 0 },
    showEducationalAnnotations: true,
    createdAt: "2026-04-19T00:00:00.000Z",
    updatedAt: "2026-04-19T00:00:00.000Z",
    lastUsedAt: null,
    ...overrides,
  };
}

interface StubAuth {
  user: AuthUser | null;
}

function makeStubAuth(initialUser: AuthUser | null = null): StubAuth {
  // Plain mutable object — the store's $effect tracks runes, not POJO
  // mutations, so tests call store._syncAuth() after each user= assignment.
  return { user: initialUser };
}

interface SyncableStore {
  _syncAuth(): void;
}

async function setUser(
  auth: StubAuth,
  store: SyncableStore,
  user: AuthUser | null,
): Promise<void> {
  auth.user = user;
  store._syncAuth();
  await Promise.resolve();
  await Promise.resolve();
}

function makePort(overrides: Partial<DataPort> = {}): DataPort {
  return {
    fetchCurrentUser: vi.fn().mockResolvedValue(null),
    getLoginUrl: () => "/login",
    logout: vi.fn().mockResolvedValue(undefined),
    startCheckout: vi.fn().mockResolvedValue({ url: "" }),
    openBillingPortal: vi.fn().mockResolvedValue({ url: "" }),
    fetchConventionDefinition: vi.fn().mockResolvedValue({}),
    listDrills: vi.fn().mockResolvedValue([]),
    createDrill: vi.fn().mockResolvedValue(fakeDto()),
    updateDrill: vi.fn().mockResolvedValue(fakeDto()),
    deleteDrill: vi.fn().mockResolvedValue(undefined),
    markDrillLaunched: vi.fn().mockResolvedValue(fakeDto()),
    ...overrides,
  };
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

describe("drills store anonymous mode", () => {
  it("hydrates from localStorage when auth.user is null", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        drills: [
          {
            id: "drill:local1",
            name: "Local",
            moduleIds: ["stayman-bundle"],
            practiceMode: PracticeMode.DecisionDrill,
            practiceRole: PracticeRole.Responder,
            systemSelectionId: "sayc",
            opponentMode: OpponentMode.Natural,
            playProfileId: "club-player",
            vulnerabilityDistribution: { none: 1, ours: 0, theirs: 0, both: 0 },
            showEducationalAnnotations: true,
            createdAt: "2026-04-19T00:00:00.000Z",
            updatedAt: "2026-04-19T00:00:00.000Z",
            lastUsedAt: null,
          },
        ],
      }),
    );

    const auth = makeStubAuth(null);
    const port = makePort();
    const store = createDrillsStore({
      defaultSystemId: "sayc",
      seedFromPrefs: TEST_DRILL_SEED,
      auth,
      dataPort: port,
    });

    expect(store.loadStatus).toBe("anonymous-ready");
    expect(store.list().map((d) => d.id)).toEqual(["drill:local1"]);
    expect(port.listDrills).not.toHaveBeenCalled();
  });

  it("runs legacy migration on first read", () => {
    localStorage.setItem(
      LEGACY_PRESETS_KEY,
      JSON.stringify({
        presets: [
          {
            id: "drill:legacy-stay",
            name: "Legacy Stayman",
            conventionId: "stayman-bundle",
            practiceMode: PracticeMode.DecisionDrill,
            practiceRole: PracticeRole.Responder,
            systemSelectionId: "sayc",
            createdAt: "2026-04-19T00:00:00.000Z",
            lastUsedAt: null,
          },
        ],
      }),
    );

    const store = createDrillsStore({
      defaultSystemId: "sayc",
      seedFromPrefs: TEST_DRILL_SEED,
    });

    expect(store.list()).toHaveLength(1);
    expect(store.list()[0]?.id).toBe("drill:preset-legacy-stay");
    expect(store.migrationSkipped).toBe(0);
  });
});

describe("drills store authenticated mode", () => {
  it("transitions loading -> authenticated-ready and reflects server list", async () => {
    const auth = makeStubAuth(null);
    const port = makePort({
      listDrills: vi.fn().mockResolvedValue([fakeDto({ id: "drill:server-1" })]),
    });
    const store = createDrillsStore({
      defaultSystemId: "sayc",
      seedFromPrefs: TEST_DRILL_SEED,
      auth,
      dataPort: port,
    });

    expect(store.loadStatus).toBe("anonymous-ready");
    auth.user = fakeUser();
    store._syncAuth();
    expect(store.loadStatus).toBe("loading");
    await Promise.resolve();
    await Promise.resolve();
    expect(store.loadStatus).toBe("authenticated-ready");
    expect(store.list().map((d) => d.id)).toEqual(["drill:server-1"]);
  });

  it("enters auth-load-error when listDrills rejects; create() rejects in that state", async () => {
    const auth = makeStubAuth(null);
    const port = makePort({
      listDrills: vi.fn().mockRejectedValue(new Error("network down")),
    });
    const store = createDrillsStore({
      defaultSystemId: "sayc",
      seedFromPrefs: TEST_DRILL_SEED,
      auth,
      dataPort: port,
    });

    await setUser(auth, store, fakeUser());
    expect(store.loadStatus).toBe("auth-load-error");
    expect(store.mutationsDisabled).toBe(true);

    await expect(
      store.create({
        name: "should fail",
        moduleIds: ["stayman-bundle"],
        practiceMode: PracticeMode.DecisionDrill,
        practiceRole: PracticeRole.Responder,
        systemSelectionId: "sayc",
        ...TEST_DRILL_TUNABLES,
      }),
    ).rejects.toThrow(/retry/);
  });

  it("logout restores anonymous list (snapshot taken before login)", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        drills: [
          {
            id: "drill:anon-1",
            name: "Anon",
            moduleIds: ["stayman-bundle"],
            practiceMode: PracticeMode.DecisionDrill,
            practiceRole: PracticeRole.Responder,
            systemSelectionId: "sayc",
            opponentMode: OpponentMode.Natural,
            playProfileId: "club-player",
            vulnerabilityDistribution: { none: 1, ours: 0, theirs: 0, both: 0 },
            showEducationalAnnotations: true,
            createdAt: "2026-04-19T00:00:00.000Z",
            updatedAt: "2026-04-19T00:00:00.000Z",
            lastUsedAt: null,
          },
        ],
      }),
    );
    const auth = makeStubAuth(null);
    const port = makePort({
      listDrills: vi.fn().mockResolvedValue([fakeDto({ id: "drill:srv" })]),
    });
    const store = createDrillsStore({
      defaultSystemId: "sayc",
      seedFromPrefs: TEST_DRILL_SEED,
      auth,
      dataPort: port,
    });

    await setUser(auth, store, fakeUser());
    expect(store.list().map((d) => d.id)).toEqual(["drill:srv"]);

    await setUser(auth, store, null);
    expect(store.loadStatus).toBe("anonymous-ready");
    expect(store.list().map((d) => d.id)).toEqual(["drill:anon-1"]);
  });

  it("generation token discards late server response after logout", async () => {
    const auth = makeStubAuth(null);
    let resolveList: ((value: DrillDto[]) => void) | null = null;
    const port = makePort({
      listDrills: vi.fn().mockImplementation(
        () =>
          new Promise<DrillDto[]>((resolve) => {
            resolveList = resolve;
          }),
      ),
    });
    const store = createDrillsStore({
      defaultSystemId: "sayc",
      seedFromPrefs: TEST_DRILL_SEED,
      auth,
      dataPort: port,
    });

    auth.user = fakeUser();
    store._syncAuth();
    expect(store.loadStatus).toBe("loading");

    auth.user = null;
    store._syncAuth();
    expect(store.loadStatus).toBe("anonymous-ready");

    resolveList!([fakeDto({ id: "drill:should-not-leak" })]);
    await Promise.resolve();
    await Promise.resolve();

    expect(store.list().map((d) => d.id)).toEqual([]);
    expect(store.loadStatus).toBe("anonymous-ready");
  });

  it("create surfaces 403 convention_locked as a structured error", async () => {
    const auth = makeStubAuth(null);
    const port = makePort({
      listDrills: vi.fn().mockResolvedValue([]),
      createDrill: vi
        .fn()
        .mockRejectedValue(new DrillEntitlementError(["bergen-bundle"])),
    });
    const store = createDrillsStore({
      defaultSystemId: "sayc",
      seedFromPrefs: TEST_DRILL_SEED,
      auth,
      dataPort: port,
    });
    await setUser(auth, store, fakeUser());
    expect(store.loadStatus).toBe("authenticated-ready");

    let caught: unknown;
    try {
      await store.create({
        name: "Bergen",
        moduleIds: ["bergen-bundle"],
        practiceMode: PracticeMode.DecisionDrill,
        practiceRole: PracticeRole.Responder,
        systemSelectionId: "sayc",
        ...TEST_DRILL_TUNABLES,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DrillEntitlementError);
    expect((caught as DrillEntitlementError).blockedModuleIds).toEqual(["bergen-bundle"]);
    expect(store.list()).toHaveLength(0);
    expect(store.isSaving).toBe(false);
  });

  it("create propagates unknown_module errors", async () => {
    const auth = makeStubAuth(null);
    const port = makePort({
      listDrills: vi.fn().mockResolvedValue([]),
      createDrill: vi
        .fn()
        .mockRejectedValue(new DrillUnknownModuleError(["nt-stayman"])),
    });
    const store = createDrillsStore({
      defaultSystemId: "sayc",
      seedFromPrefs: TEST_DRILL_SEED,
      auth,
      dataPort: port,
    });
    await setUser(auth, store, fakeUser());

    await expect(
      store.create({
        name: "Legacy",
        moduleIds: ["stayman-bundle"], // canonicalization keeps as-is
        practiceMode: PracticeMode.DecisionDrill,
        practiceRole: PracticeRole.Responder,
        systemSelectionId: "sayc",
        ...TEST_DRILL_TUNABLES,
      }),
    ).rejects.toBeInstanceOf(DrillUnknownModuleError);
  });

  it("authenticated create commits the server-returned drill to in-memory list", async () => {
    const auth = makeStubAuth(null);
    const created: DrillDto = fakeDto({ id: "drill:server-id", name: "Saved" });
    const port = makePort({
      listDrills: vi.fn().mockResolvedValue([]),
      createDrill: vi.fn().mockImplementation((p: DrillCreatePayload) => {
        expect(p.name).toBe("Saved");
        return Promise.resolve(created);
      }),
    });
    const store = createDrillsStore({
      defaultSystemId: "sayc",
      seedFromPrefs: TEST_DRILL_SEED,
      auth,
      dataPort: port,
    });
    await setUser(auth, store, fakeUser());

    const drill = await store.create({
      name: "Saved",
      moduleIds: ["stayman-bundle"],
      practiceMode: PracticeMode.DecisionDrill,
      practiceRole: PracticeRole.Responder,
      systemSelectionId: "sayc",
      ...TEST_DRILL_TUNABLES,
    });
    expect(drill.id).toBe("drill:server-id");
    expect(store.list().map((d) => d.id)).toEqual(["drill:server-id"]);
  });

  it("update sends merged payload and applies server response", async () => {
    const auth = makeStubAuth(null);
    const initialDto = fakeDto({ id: "drill:edit", name: "before" });
    const updatedDto = fakeDto({ id: "drill:edit", name: "after" });
    const updateSpy = vi.fn().mockImplementation((id: string, _p: DrillUpdatePayload) => {
      expect(id).toBe("drill:edit");
      return Promise.resolve(updatedDto);
    });
    const port = makePort({
      listDrills: vi.fn().mockResolvedValue([initialDto]),
      updateDrill: updateSpy,
    });
    const store = createDrillsStore({
      defaultSystemId: "sayc",
      seedFromPrefs: TEST_DRILL_SEED,
      auth,
      dataPort: port,
    });
    await setUser(auth, store, fakeUser());

    await store.update("drill:edit", { name: "after" });
    expect(updateSpy).toHaveBeenCalled();
    expect(store.getById("drill:edit")?.name).toBe("after");
  });

  it("delete removes from list after server confirms", async () => {
    const auth = makeStubAuth(null);
    const initialDto = fakeDto({ id: "drill:del" });
    const deleteSpy = vi.fn().mockResolvedValue(undefined);
    const port = makePort({
      listDrills: vi.fn().mockResolvedValue([initialDto]),
      deleteDrill: deleteSpy,
    });
    const store = createDrillsStore({
      defaultSystemId: "sayc",
      seedFromPrefs: TEST_DRILL_SEED,
      auth,
      dataPort: port,
    });
    await setUser(auth, store, fakeUser());
    expect(store.list()).toHaveLength(1);

    await store.delete("drill:del");
    expect(deleteSpy).toHaveBeenCalledWith("drill:del");
    expect(store.list()).toHaveLength(0);
  });
});
