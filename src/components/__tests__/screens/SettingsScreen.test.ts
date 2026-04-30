import { fireEvent, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppStore } from "../../../stores/app.svelte";
import { createAuthStore } from "../../../stores/auth.svelte";
import type { DataPort } from "../../../service";
import SettingsScreenTestWrapper from "./SettingsScreenTestWrapper.svelte";

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

describe("SettingsScreen — Display section", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates app store cardSize when the Large toggle is clicked", async () => {
    const appStore = createAppStore();
    const authStore = createAuthStore(createStubDataPort());

    expect(appStore.displaySettings.cardSize).toBe("medium");

    const { getByTestId } = render(SettingsScreenTestWrapper, {
      props: { appStore, authStore },
    });

    await fireEvent.click(getByTestId("display-card-size-large"));

    expect(appStore.displaySettings.cardSize).toBe("large");
  });

  it("updates app store suitColorScheme when the Four-color toggle is clicked", async () => {
    const appStore = createAppStore();
    const authStore = createAuthStore(createStubDataPort());

    expect(appStore.displaySettings.suitColorScheme).toBe("two-color");

    const { getByTestId } = render(SettingsScreenTestWrapper, {
      props: { appStore, authStore },
    });

    await fireEvent.click(getByTestId("display-suit-colors-four-color"));

    expect(appStore.displaySettings.suitColorScheme).toBe("four-color");
  });

  it("updates app store tenNotation when the T toggle is clicked", async () => {
    const appStore = createAppStore();
    const authStore = createAuthStore(createStubDataPort());

    expect(appStore.displaySettings.tenNotation).toBe("ten");

    const { getByTestId } = render(SettingsScreenTestWrapper, {
      props: { appStore, authStore },
    });

    await fireEvent.click(getByTestId("display-ten-notation-t"));

    expect(appStore.displaySettings.tenNotation).toBe("t");
  });
});
