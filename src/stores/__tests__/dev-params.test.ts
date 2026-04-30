import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConventionCategory, PracticeMode } from "../../service";
import { setWasmModule } from "../../service/service-helpers";
import { createAppStore } from "../app.svelte";
import { applyDevParams } from "../dev-params";
import * as navigation from "$app/navigation";

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

  get_module_flow_tree() {
    return null;
  }
}

describe("applyDevParams", () => {
  beforeEach(() => {
    vi.spyOn(navigation, "goto");
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
    vi.restoreAllMocks();
  });

  it("defaults ?convention deep links to decision-drill and navigates to /game", () => {
    window.history.replaceState({}, "", "/?convention=nt-bundle&seed=42");
    const store = createAppStore();

    applyDevParams(store);

    expect(store.selectedConvention?.id).toBe("nt-bundle");
    expect(store.devPracticeMode).toBe(PracticeMode.DecisionDrill);
    expect(store.devSeed).toBe(42);
    expect(navigation.goto).toHaveBeenCalledWith("/game");
  });

  it("preserves an explicit practiceMode override from the URL", () => {
    window.history.replaceState(
      {},
      "",
      "/?convention=nt-bundle&practiceMode=full-auction",
    );
    const store = createAppStore();

    applyDevParams(store);

    expect(store.devPracticeMode).toBe(PracticeMode.FullAuction);
    expect(navigation.goto).toHaveBeenCalledWith("/game");
  });
});
