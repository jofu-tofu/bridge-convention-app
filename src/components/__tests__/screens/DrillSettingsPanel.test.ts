import { fireEvent, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PracticeMode } from "../../../service";
import { createCustomSystemsStore } from "../../../stores/custom-systems.svelte";
import { createAppStore } from "../../../stores/app.svelte";
import DrillSettingsPanelTestWrapper from "./DrillSettingsPanelTestWrapper.svelte";

function createStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
}

describe("DrillSettingsPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates the app store when the mode toggle changes", async () => {
    const appStore = createAppStore();
    const customSystemsStore = createCustomSystemsStore();

    const { getByTestId } = render(DrillSettingsPanelTestWrapper, {
      props: {
        appStore,
        customSystemsStore,
      },
    });

    expect(getByTestId("practice-settings-role-auto").getAttribute("aria-pressed")).toBe("true");

    await fireEvent.click(getByTestId("practice-settings-mode-full"));

    expect(appStore.userPracticeMode).toBe(PracticeMode.FullAuction);
  });
});
