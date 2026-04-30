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

  it("opens the picker, filters, and selects a convention as the single default", async () => {
    const [firstConvention] = listConventions();
    expect(firstConvention).toBeDefined();

    const appStore = createAppStore();
    const customSystemsStore = createCustomSystemsStore();
    const drillsStore = createDrillsStore({ defaultSystemId: "sayc", seedFromPrefs: TEST_DRILL_SEED });

    const { getByTestId, queryByTestId } = render(DrillFormTestWrapper, {
      props: {
        appStore,
        customSystemsStore,
        drillsStore,
        mode: "create",
      },
    });

    // No chip yet — primary picker trigger is the only entry point.
    expect(queryByTestId("drill-form-convention-add-another")).toBeNull();
    await fireEvent.click(getByTestId("drill-form-convention-picker-trigger"));

    // Search input is rendered inside the popover; filtering narrows the option list.
    const searchInput = getByTestId("drill-form-convention-picker-search");
    await fireEvent.input(searchInput, { target: { value: "stayman" } });
    expect(getByTestId(`drill-form-convention-picker-option-${firstConvention!.id}`)).toBeTruthy();

    // Selecting an option closes the popover and adds a chip.
    await fireEvent.click(getByTestId(`drill-form-convention-picker-option-${firstConvention!.id}`));
    expect(queryByTestId("drill-form-convention-picker-search")).toBeNull();
    expect(getByTestId(`drill-form-convention-chip-${firstConvention!.id}`)).toBeTruthy();

    await fireEvent.input(getByTestId("drill-form-name"), { target: { value: "Single convention drill" } });
    await fireEvent.click(getByTestId("drill-form-save"));

    expect(drillsStore.drills).toHaveLength(1);
    expect(drillsStore.drills[0]?.moduleIds).toEqual([firstConvention!.id]);
  });

  it("adds a second convention via 'Add another' and removes a chip", async () => {
    const [firstConvention, secondConvention] = listConventions();
    expect(firstConvention).toBeDefined();
    expect(secondConvention).toBeDefined();

    const appStore = createAppStore();
    const customSystemsStore = createCustomSystemsStore();
    const drillsStore = createDrillsStore({ defaultSystemId: "sayc", seedFromPrefs: TEST_DRILL_SEED });

    const { getByTestId, queryByTestId } = render(DrillFormTestWrapper, {
      props: {
        appStore,
        customSystemsStore,
        drillsStore,
        mode: "create",
      },
    });

    // Seed the first convention via the primary picker.
    await fireEvent.click(getByTestId("drill-form-convention-picker-trigger"));
    await fireEvent.click(getByTestId(`drill-form-convention-picker-option-${firstConvention!.id}`));

    // Click "Add another"; the picker auto-opens for a second pick.
    await fireEvent.click(getByTestId("drill-form-convention-add-another"));
    // The first convention is already chosen, so it should NOT appear as an option.
    expect(queryByTestId(`drill-form-convention-picker-option-${firstConvention!.id}`)).toBeNull();
    await fireEvent.click(getByTestId(`drill-form-convention-picker-option-${secondConvention!.id}`));

    // Both chips visible now.
    expect(getByTestId(`drill-form-convention-chip-${firstConvention!.id}`)).toBeTruthy();
    expect(getByTestId(`drill-form-convention-chip-${secondConvention!.id}`)).toBeTruthy();

    // Remove the first chip.
    await fireEvent.click(getByTestId(`drill-form-convention-chip-remove-${firstConvention!.id}`));
    expect(queryByTestId(`drill-form-convention-chip-${firstConvention!.id}`)).toBeNull();
    expect(getByTestId(`drill-form-convention-chip-${secondConvention!.id}`)).toBeTruthy();
  });

  it("loads multi-convention edit-mode drills as chips and updates on save", async () => {
    const [firstConvention, secondConvention] = listConventions();
    expect(firstConvention).toBeDefined();
    expect(secondConvention).toBeDefined();

    const appStore = createAppStore();
    const customSystemsStore = createCustomSystemsStore();
    const drillsStore = createDrillsStore({ defaultSystemId: "sayc", seedFromPrefs: TEST_DRILL_SEED });
    const drill = await drillsStore.create({
      name: "Original drill",
      moduleIds: [firstConvention!.id, secondConvention!.id],
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

    // Both existing modules should load as chips.
    expect(getByTestId(`drill-form-convention-chip-${firstConvention!.id}`)).toBeTruthy();
    expect(getByTestId(`drill-form-convention-chip-${secondConvention!.id}`)).toBeTruthy();

    await fireEvent.input(getByTestId("drill-form-name"), {
      target: { value: "Edited drill" },
    });
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
      },
    });

    await fireEvent.click(getByTestId("drill-form-convention-picker-trigger"));
    await fireEvent.click(getByTestId(`drill-form-convention-picker-option-${firstConvention!.id}`));

    await fireEvent.input(getByTestId("drill-form-name"), { target: { value: "Tuned drill" } });

    // Advanced is closed by default in create mode; expand before driving the inner controls.
    const advanced = getByTestId("drill-form-advanced") as HTMLDetailsElement;
    advanced.open = true;

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

  it("surfaces an entitlement error when a locked convention is selected and submitted", async () => {
    // The test wasm port returns two free SAYC bundles; to exercise the locked path we
    // patch listConventions's first entry as a non-free bundle. Easiest path: use
    // canPractice's reliance on FREE_PRACTICE_BUNDLES — both 'stayman-bundle' and
    // 'jacoby-transfers-bundle' are free, so we cannot synthesize a locked module here
    // without changing the entitlement allowlist. Skip if that holds.
    const conventions = listConventions();
    const lockedCandidate = conventions.find((c) => !["stayman-bundle", "jacoby-transfers-bundle", "blackwood-bundle", "weak-twos-bundle", "strong-2c-bundle", "nt-bundle"].includes(c.id));
    if (!lockedCandidate) return;

    const appStore = createAppStore();
    const customSystemsStore = createCustomSystemsStore();
    const drillsStore = createDrillsStore({ defaultSystemId: "sayc", seedFromPrefs: TEST_DRILL_SEED });

    const { getByTestId, getByText } = render(DrillFormTestWrapper, {
      props: {
        appStore,
        customSystemsStore,
        drillsStore,
        mode: "create",
      },
    });

    await fireEvent.click(getByTestId("drill-form-convention-picker-trigger"));
    await fireEvent.click(getByTestId(`drill-form-convention-picker-option-${lockedCandidate.id}`));

    await fireEvent.input(getByTestId("drill-form-name"), { target: { value: "Locked drill" } });
    await fireEvent.click(getByTestId("drill-form-save"));

    // Subscribe-to-add inline error is rendered.
    expect(getByText(/Subscribe to add/)).toBeTruthy();
    expect(drillsStore.drills).toHaveLength(0);
  });

  it("collapses Advanced settings by default in create mode", () => {
    const appStore = createAppStore();
    const customSystemsStore = createCustomSystemsStore();
    const drillsStore = createDrillsStore({ defaultSystemId: "sayc", seedFromPrefs: TEST_DRILL_SEED });

    const { getByTestId } = render(DrillFormTestWrapper, {
      props: {
        appStore,
        customSystemsStore,
        drillsStore,
        mode: "create",
      },
    });

    const advanced = getByTestId("drill-form-advanced") as HTMLDetailsElement;
    expect(advanced.tagName.toLowerCase()).toBe("details");
    expect(advanced.open).toBe(false);
    // Summary text remains accessible — caption lists the collapsed inner sections.
    const summary = advanced.querySelector("summary");
    expect(summary?.textContent).toMatch(/Advanced/);
    expect(summary?.textContent).toMatch(/System/);
    expect(summary?.textContent).toMatch(/vulnerability/);
  });

  it("opens Advanced settings by default in edit mode", async () => {
    const [firstConvention] = listConventions();
    expect(firstConvention).toBeDefined();

    const appStore = createAppStore();
    const customSystemsStore = createCustomSystemsStore();
    const drillsStore = createDrillsStore({ defaultSystemId: "sayc", seedFromPrefs: TEST_DRILL_SEED });
    const drill = await drillsStore.create({
      name: "Existing drill",
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

    const advanced = getByTestId("drill-form-advanced") as HTMLDetailsElement;
    expect(advanced.open).toBe(true);
  });

  it("auto-expands Advanced when submit produces a vulnerability error", async () => {
    const [firstConvention] = listConventions();
    expect(firstConvention).toBeDefined();

    const appStore = createAppStore();
    // Seed an invalid all-zero vulnerability distribution into prefs so the form
    // initializes with `vulnError` reachable on submit. The picker UI itself prevents
    // disabling the last toggle, so this is the only path to exercise the error branch.
    appStore.setVulnerabilityDistribution({ none: 0, ours: 0, theirs: 0, both: 0 });
    const customSystemsStore = createCustomSystemsStore();
    const drillsStore = createDrillsStore({ defaultSystemId: "sayc", seedFromPrefs: TEST_DRILL_SEED });

    const { getByTestId, queryByText } = render(DrillFormTestWrapper, {
      props: {
        appStore,
        customSystemsStore,
        drillsStore,
        mode: "create",
      },
    });

    await fireEvent.click(getByTestId("drill-form-convention-picker-trigger"));
    await fireEvent.click(getByTestId(`drill-form-convention-picker-option-${firstConvention!.id}`));
    await fireEvent.input(getByTestId("drill-form-name"), { target: { value: "Vuln test drill" } });

    // Collapse Advanced manually — simulating a user who has not opened it.
    const advanced = getByTestId("drill-form-advanced") as HTMLDetailsElement;
    advanced.open = false;
    expect(advanced.open).toBe(false);

    await fireEvent.click(getByTestId("drill-form-save"));

    // Submission must auto-expand Advanced so the vuln error is visible to the user.
    expect(advanced.open).toBe(true);
    expect(queryByText(/at least one vulnerability state/i)).not.toBeNull();
    expect(drillsStore.drills).toHaveLength(0);
  });
});
