import { fireEvent, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listConventions, OpponentMode, PracticeMode, PracticeRole } from "../../../service";
import { ConventionCategory } from "../../../service/session-types";
import { setWasmModule } from "../../../service/service-helpers";
import { createAppStore } from "../../../stores/app.svelte";
import { createCustomSystemsStore } from "../../../stores/custom-systems.svelte";
import { createDrillsStore } from "../../../stores/drills.svelte";
import DrillFormTestWrapper from "./DrillFormTestWrapper.svelte";
import { TEST_DRILL_SEED, TEST_DRILL_TUNABLES } from "../../../test-support/fixtures";

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
        id: "jacoby-transfers-bundle",
        name: "Transfers",
        description: "Transfer to a major after 1NT.",
        category: ConventionCategory.Constructive,
        defaultRole: PracticeRole.Responder,
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

describe("DrillForm", () => {
  beforeEach(() => {
    setWasmModule({ WasmServicePort: TestWasmServicePort }, new TestWasmServicePort());
    vi.stubGlobal("localStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a saved drill from the form", async () => {
    const [firstConvention] = listConventions();
    expect(firstConvention).toBeDefined();

    const appStore = createAppStore();
    const customSystemsStore = createCustomSystemsStore();
    const drillsStore = createDrillsStore({ defaultSystemId: "sayc", seedFromPrefs: TEST_DRILL_SEED });

    const { getByTestId } = render(DrillFormTestWrapper, {
      props: {
        appStore,
        customSystemsStore,
        drillsStore,
        mode: "create",
        prefillConvention: firstConvention!.id,
      },
    });

    await fireEvent.input(getByTestId("drill-form-name"), {
      target: { value: "  My saved drill  " },
    });
    await fireEvent.click(getByTestId("drill-form-save"));

    expect(drillsStore.drills).toHaveLength(1);
    expect(drillsStore.drills[0]).toMatchObject({
      name: "My saved drill",
      moduleIds: [firstConvention!.id],
      practiceMode: PracticeMode.DecisionDrill,
      practiceRole: "auto",
    });
  });

  it("updates an existing drill from the edit form", async () => {
    const [firstConvention, secondConvention] = listConventions();
    expect(firstConvention).toBeDefined();
    expect(secondConvention).toBeDefined();

    const appStore = createAppStore();
    const customSystemsStore = createCustomSystemsStore();
    const drillsStore = createDrillsStore({ defaultSystemId: "sayc", seedFromPrefs: TEST_DRILL_SEED });
    const drill = await drillsStore.create({
      name: "Original drill",
      moduleIds: [firstConvention!.id],
      practiceMode: PracticeMode.DecisionDrill,
      practiceRole: PracticeRole.Responder,
      systemSelectionId: "sayc",
      ...TEST_DRILL_TUNABLES,
    });

    const { getByTestId } = render(DrillFormTestWrapper, {
      props: {
        appStore,
        customSystemsStore,
        drillsStore,
        mode: "edit",
        drill,
      },
    });

    await fireEvent.input(getByTestId("drill-form-name"), {
      target: { value: "Edited drill" },
    });
    await fireEvent.click(getByTestId(`drill-form-convention-${secondConvention!.id}`));
    await fireEvent.click(getByTestId("drill-form-role-opener"));
    await fireEvent.click(getByTestId("drill-form-save"));

    expect(drillsStore.getById(drill.id)).toMatchObject({
      name: "Edited drill",
      moduleIds: [firstConvention!.id, secondConvention!.id],
      practiceRole: PracticeRole.Opener,
    });
  });

  it("captures opponents, play skill, vulnerability and annotations on save", async () => {
    const [firstConvention] = listConventions();
    expect(firstConvention).toBeDefined();

    const appStore = createAppStore();
    const customSystemsStore = createCustomSystemsStore();
    const drillsStore = createDrillsStore({ defaultSystemId: "sayc", seedFromPrefs: TEST_DRILL_SEED });

    const { getByTestId } = render(DrillFormTestWrapper, {
      props: {
        appStore,
        customSystemsStore,
        drillsStore,
        mode: "create",
        prefillConvention: firstConvention!.id,
      },
    });

    await fireEvent.input(getByTestId("drill-form-name"), { target: { value: "Tuned drill" } });
    await fireEvent.click(getByTestId("drill-form-opponents-natural"));
    await fireEvent.click(getByTestId("drill-form-skill-beginner"));
    await fireEvent.click(getByTestId("drill-form-vuln-toggle-both"));
    await fireEvent.click(getByTestId("drill-form-annotations"));
    await fireEvent.click(getByTestId("drill-form-save"));

    expect(drillsStore.drills).toHaveLength(1);
    const saved = drillsStore.drills[0]!;
    expect(saved.opponentMode).toBe(OpponentMode.Natural);
    expect(saved.playProfileId).toBe("beginner");
    expect(saved.vulnerabilityDistribution.both).toBeGreaterThan(0);
    expect(saved.showEducationalAnnotations).toBe(false);
  });
});
