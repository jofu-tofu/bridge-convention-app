import { render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataPort } from "../../../service";
import type * as ServiceModule from "../../../service";

// Heavy mocks: the (app) layout boots WASM and constructs all stores. For a
// pure DOM/data-attribute test we mock those heavy dependencies. The fake
// appStore is in a `.svelte.ts` file so it can use $state for reactivity.
vi.mock("../../../stores/app.svelte", async () => {
  const mod = await import("./fake-app-store.svelte");
  return {
    createAppStore: mod.createFakeAppStore,
  };
});

vi.mock("../../../stores/custom-systems.svelte", () => ({
  createCustomSystemsStore: () => ({
    get systems() {
      return [];
    },
    isValidSelection: () => true,
  }),
}));

vi.mock("../../../stores/user-modules.svelte", () => ({
  createUserModuleStore: () => ({}),
}));

vi.mock("../../../stores/drills.svelte", () => ({
  createDrillsStore: () => ({}),
}));

vi.mock("../../../stores/game.svelte", () => ({
  createGameStore: () => ({}),
}));

vi.mock("../../../stores/dev-params", () => ({
  applyDevParams: () => {},
  getDevAuthOverride: () => null,
}));

vi.mock("../../../service", async (importActual) => {
  const actual = await importActual<typeof ServiceModule>();
  class FakeBridgeService {
    init() {
      return Promise.resolve();
    }
  }
  return {
    ...actual,
    BridgeService: FakeBridgeService,
  };
});

// AppShell pulls in nav chrome + many components — stub it with a passthrough.
vi.mock("../../../components/navigation/AppShell.svelte", async () => {
  const mod = await import("./AppShellStub.svelte");
  return mod;
});

import AppLayoutTestWrapper from "./AppLayoutTestWrapper.svelte";
import { getCapturedFakeAppStore } from "./fake-app-store.svelte";

function createStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
}

function createStubDataPort(): DataPort {
  return {
    fetchCurrentUser: () => Promise.resolve(null),
    getLoginUrl: () => "",
    logout: () => Promise.resolve(),
    listDrills: () => Promise.resolve([]),
    createDrill: () => Promise.reject(new Error("not implemented")),
    updateDrill: () => Promise.reject(new Error("not implemented")),
    deleteDrill: () => Promise.resolve(),
    markDrillLaunched: () => Promise.resolve(),
    createCheckoutSession: () => Promise.reject(new Error("not implemented")),
    createBillingPortalSession: () => Promise.reject(new Error("not implemented")),
  } as unknown as DataPort;
}

describe("(app)/+layout — display settings on layout root", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("binds data-card-size and --card-size-scale on the root div", async () => {
    const { container } = render(AppLayoutTestWrapper, {
      props: { dataPort: createStubDataPort() },
    });

    // Wait for layout init's then() to run and engineReady to flip.
    await waitFor(() => {
      const root = container.querySelector<HTMLDivElement>("[data-card-size]");
      expect(root).not.toBeNull();
    });

    const root = container.querySelector<HTMLDivElement>("[data-card-size]")!;
    expect(root.getAttribute("data-card-size")).toBe("medium");
    expect(root.style.getPropertyValue("--card-size-scale")).toBe("1");

    const appStore = getCapturedFakeAppStore();
    expect(appStore).not.toBeNull();
    appStore!.setCardSize("large");

    await waitFor(() => {
      expect(root.getAttribute("data-card-size")).toBe("large");
    });
    expect(root.style.getPropertyValue("--card-size-scale")).toBe("1.15");
  });
});
