import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConventionCategory, PracticeMode } from "../../service";
import { setWasmModule } from "../../service/service-helpers";
import { createAppStore } from "../app.svelte";
import { applyDevParams } from "../dev-params";

class TestWasmServicePort {
  list_conventions() {
    return [
      {
        id: "nt-bundle",
        name: "1NT Responses",
        description: "desc",
        category: ConventionCategory.Asking,
      },
    ];
  }

  list_modules() {
    return [];
  }

  get_module_learning_viewport() {
    return null;
  }

  get_bundle_flow_tree() {
    return null;
  }

  get_module_flow_tree() {
    return null;
  }
}

describe("applyDevParams", () => {
  beforeEach(() => {
    setWasmModule({
      WasmServicePort: TestWasmServicePort,
    });
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } satisfies Storage);
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults ?convention deep links to decision-drill and opens the game", () => {
    window.history.replaceState({}, "", "/?convention=nt-bundle&seed=42");
    const store = createAppStore();

    applyDevParams(store);

    expect(store.screen).toBe("game");
    expect(store.selectedConvention?.id).toBe("nt-bundle");
    expect(store.devPracticeMode).toBe(PracticeMode.DecisionDrill);
    expect(store.devSeed).toBe(42);
  });

  it("preserves an explicit practiceMode override from the URL", () => {
    window.history.replaceState(
      {},
      "",
      "/?convention=nt-bundle&practiceMode=full-auction",
    );
    const store = createAppStore();

    applyDevParams(store);

    expect(store.screen).toBe("game");
    expect(store.devPracticeMode).toBe(PracticeMode.FullAuction);
  });
});
