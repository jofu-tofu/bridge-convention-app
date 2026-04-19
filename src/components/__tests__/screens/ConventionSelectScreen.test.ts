import { fireEvent, render, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PracticeMode, PracticeRole } from "../../../service";
import { ConventionCategory } from "../../../service/session-types";
import { setWasmModule } from "../../../service/service-helpers";
import { createAppStore } from "../../../stores/app.svelte";
import { createCustomSystemsStore } from "../../../stores/custom-systems.svelte";
import { createDrillsStore } from "../../../stores/drills.svelte";
import ConventionSelectScreenTestWrapper from "./ConventionSelectScreenTestWrapper.svelte";
import { TEST_DRILL_SEED } from "../../../test-support/fixtures";

const { gotoMock } = vi.hoisted(() => ({
  gotoMock: vi.fn(),
}));

vi.mock("$app/navigation", () => ({
  goto: gotoMock,
}));

vi.mock("$app/state", () => ({
  page: {
    url: new URL("http://localhost/practice"),
  },
}));

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
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
}

class TestWasmServicePort {
  list_conventions() {
    return [
      {
        id: "stayman-bundle",
        name: "Stayman",
        description: "Ask for a four-card major after 1NT.",
        category: ConventionCategory.Asking,
        defaultRole: PracticeRole.Responder,
        variesBySystem: false,
      },
      {
        id: "weak-two-bundle",
        name: "Weak Two",
        description: "Preempt with a six-card suit.",
        category: ConventionCategory.Competitive,
        defaultRole: PracticeRole.Opener,
        variesBySystem: false,
      },
    ];
  }

  list_modules() {
    return [];
  }

  get_module_learning_viewport() {
    return null;
  }

  get_module_flow_tree() {
    return null;
  }
}

describe("ConventionSelectScreen", () => {
  beforeEach(() => {
    setWasmModule({ WasmServicePort: TestWasmServicePort }, new TestWasmServicePort());
    vi.stubGlobal("localStorage", createStorage());
    gotoMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the convention default role badge and links the configure action to the drill form", () => {
    const appStore = createAppStore();
    const customSystemsStore = createCustomSystemsStore();
    const drillsStore = createDrillsStore({ defaultSystemId: "sayc", seedFromPrefs: TEST_DRILL_SEED });

    const { getByTestId } = render(ConventionSelectScreenTestWrapper, {
      props: {
        appStore,
        authStore: {
          user: null,
          isLoggedIn: false,
          loading: false,
          login: () => {},
          logout: async () => {},
          refresh: async () => null,
          canDevLogin: false,
          devLogin: async () => {},
        },
        customSystemsStore,
        drillsStore,
      },
    });

    expect(within(getByTestId("convention-stayman-bundle")).getByText("Responder")).toBeTruthy();
    expect(getByTestId("configure-stayman-bundle").getAttribute("href")).toBe(
      "/practice/drills/new?convention=stayman-bundle",
    );
  });

  it("launches practice through applyDrillSession using the convention default role", async () => {
    const appStore = createAppStore();
    const customSystemsStore = createCustomSystemsStore();
    const drillsStore = createDrillsStore({ defaultSystemId: "sayc", seedFromPrefs: TEST_DRILL_SEED });
    const applyDrillSessionSpy = vi.spyOn(appStore, "applyDrillSession");

    const { getByTestId } = render(ConventionSelectScreenTestWrapper, {
      props: {
        appStore,
        authStore: {
          user: null,
          isLoggedIn: false,
          loading: false,
          login: () => {},
          logout: async () => {},
          refresh: async () => null,
          canDevLogin: false,
          devLogin: async () => {},
        },
        customSystemsStore,
        drillsStore,
      },
    });

    await fireEvent.click(getByTestId("practice-stayman-bundle"));

    expect(applyDrillSessionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleIds: ["stayman-bundle"],
        practiceMode: PracticeMode.DecisionDrill,
        practiceRole: PracticeRole.Responder,
        systemSelectionId: "sayc",
        sourceDrillId: null,
      }),
      expect.arrayContaining([
        expect.objectContaining({
          id: "stayman-bundle",
          defaultRole: PracticeRole.Responder,
        }),
      ]),
    );
    const sentLaunchConfig = applyDrillSessionSpy.mock.calls[0]?.[0];
    expect(sentLaunchConfig).toMatchObject({
      opponentMode: expect.any(String),
      playProfileId: expect.any(String),
      vulnerabilityDistribution: expect.any(Object),
      showEducationalAnnotations: expect.any(Boolean),
    });
    expect(appStore.activeLaunch).toMatchObject({
      moduleIds: ["stayman-bundle"],
      sourceDrillId: null,
    });
    expect(gotoMock).toHaveBeenCalledWith("/game");
  });
});
