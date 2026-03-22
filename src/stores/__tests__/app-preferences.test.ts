import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createAppStore } from "../app.svelte";

const SETTINGS_KEY = "bridge-app:practice-preferences";

const DEFAULTS = {
  baseSystemId: "sayc",
  opponentMode: "natural",
  drillTuning: { vulnerabilityDistribution: { none: 1, ours: 0, theirs: 0, both: 0 } },
  display: { showEducationalAnnotations: true },
};

// Node 25 ships a broken global localStorage that shadows jsdom's.
// Provide a spec-compliant in-memory shim so tests (and production code) work.
function createStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── localStorage persistence ───────────────────────────────

describe("localStorage persistence", () => {
  it("fresh store uses defaults when localStorage is empty", () => {
    const store = createAppStore();
    expect(store.baseSystemId).toBe("sayc");
    expect(store.opponentMode).toBe("natural");
    expect(store.drillTuning.vulnerabilityDistribution).toEqual({
      none: 1, ours: 0, theirs: 0, both: 0,
    });
    expect(store.displaySettings.showEducationalAnnotations).toBe(true);
  });

  it("setBaseSystemId persists to localStorage", () => {
    const store = createAppStore();
    store.setBaseSystemId("two-over-one");
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)!);
    expect(saved.baseSystemId).toBe("two-over-one");
  });

  it("loads preferences from localStorage on creation", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      ...DEFAULTS,
      baseSystemId: "two-over-one",
      opponentMode: "none",
    }));
    const store = createAppStore();
    expect(store.baseSystemId).toBe("two-over-one");
    expect(store.opponentMode).toBe("none");
  });
});

// ─── Legacy migration ───────────────────────────────────────

describe("legacy migration", () => {
  it("remaps displaySettings → display from bridge-app:settings", () => {
    localStorage.setItem("bridge-app:settings", JSON.stringify({
      displaySettings: { showEducationalAnnotations: false },
    }));
    const store = createAppStore();
    expect(store.displaySettings.showEducationalAnnotations).toBe(false);
    expect(localStorage.getItem("bridge-app:settings")).toBeNull();
    expect(localStorage.getItem(SETTINGS_KEY)).not.toBeNull();
  });

  it("migrates scattered legacy keys", () => {
    localStorage.setItem("bridge-app:opponent-mode", "none");
    localStorage.setItem("bridge-app:base-system", "sayc");
    const store = createAppStore();
    expect(store.opponentMode).toBe("none");
    expect(store.baseSystemId).toBe("sayc");
  });

  it("removes all legacy keys after migration", () => {
    localStorage.setItem("bridge-app:opponent-mode", "none");
    localStorage.setItem("bridge-app:base-system", "sayc");
    localStorage.setItem("bridge-app:drill-tuning", JSON.stringify({
      vulnerabilityDistribution: { none: 0, ours: 1, theirs: 0, both: 0 },
    }));
    localStorage.setItem("bridge-app:display-settings", JSON.stringify({
      showEducationalAnnotations: false,
    }));
    createAppStore();
    expect(localStorage.getItem("bridge-app:opponent-mode")).toBeNull();
    expect(localStorage.getItem("bridge-app:base-system")).toBeNull();
    expect(localStorage.getItem("bridge-app:drill-tuning")).toBeNull();
    expect(localStorage.getItem("bridge-app:display-settings")).toBeNull();
    expect(localStorage.getItem(SETTINGS_KEY)).not.toBeNull();
  });

  it("migrates drill-tuning and display-settings from legacy keys", () => {
    localStorage.setItem("bridge-app:drill-tuning", JSON.stringify({
      vulnerabilityDistribution: { none: 0, ours: 0, theirs: 1, both: 0 },
    }));
    localStorage.setItem("bridge-app:display-settings", JSON.stringify({
      showEducationalAnnotations: false,
    }));
    const store = createAppStore();
    expect(store.drillTuning.vulnerabilityDistribution).toEqual({
      none: 0, ours: 0, theirs: 1, both: 0,
    });
    expect(store.displaySettings.showEducationalAnnotations).toBe(false);
  });
});

// ─── Validation (mergePreferences) ──────────────────────────

describe("validation via mergePreferences", () => {
  it("invalid baseSystemId falls back to sayc", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      ...DEFAULTS, baseSystemId: "bogus",
    }));
    expect(createAppStore().baseSystemId).toBe("sayc");
  });

  it("invalid opponentMode falls back to natural", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      ...DEFAULTS, opponentMode: "aggressive",
    }));
    expect(createAppStore().opponentMode).toBe("natural");
  });

  it("invalid vulnerabilityDistribution falls back to default", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      ...DEFAULTS,
      drillTuning: { vulnerabilityDistribution: { none: 1 } },
    }));
    expect(createAppStore().drillTuning.vulnerabilityDistribution).toEqual({
      none: 1, ours: 0, theirs: 0, both: 0,
    });
  });

  it("partial preferences are filled with defaults", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ opponentMode: "none" }));
    const store = createAppStore();
    expect(store.opponentMode).toBe("none");
    expect(store.baseSystemId).toBe("sayc");
    expect(store.displaySettings.showEducationalAnnotations).toBe(true);
  });
});

// ─── Setter behavior ────────────────────────────────────────

describe("setter behavior", () => {
  it("setBaseSystemId changes value and persists", () => {
    const store = createAppStore();
    store.setBaseSystemId("two-over-one");
    expect(store.baseSystemId).toBe("two-over-one");
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)!);
    expect(saved.baseSystemId).toBe("two-over-one");
  });

  it("setOpponentMode changes value", () => {
    const store = createAppStore();
    store.setOpponentMode("none");
    expect(store.opponentMode).toBe("none");
  });

  it("setVulnerabilityDistribution changes distribution", () => {
    const store = createAppStore();
    const dist = { none: 0, ours: 1, theirs: 1, both: 0 };
    store.setVulnerabilityDistribution(dist);
    expect(store.drillTuning.vulnerabilityDistribution).toEqual(dist);
  });

  it("setOffConventionRate clamps to [0, 1]", () => {
    const store = createAppStore();
    store.setOffConventionRate(-0.5);
    expect(store.drillTuning.offConventionRate).toBe(0);
    store.setOffConventionRate(1.5);
    expect(store.drillTuning.offConventionRate).toBe(1);
    store.setOffConventionRate(0.4);
    expect(store.drillTuning.offConventionRate).toBe(0.4);
  });

  it("setShowEducationalAnnotations changes display preference", () => {
    const store = createAppStore();
    expect(store.displaySettings.showEducationalAnnotations).toBe(true);
    store.setShowEducationalAnnotations(false);
    expect(store.displaySettings.showEducationalAnnotations).toBe(false);
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)!);
    expect(saved.display.showEducationalAnnotations).toBe(false);
  });

  it("setIncludeOffConvention changes flag and persists", () => {
    const store = createAppStore();
    store.setIncludeOffConvention(true);
    expect(store.drillTuning.includeOffConvention).toBe(true);
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)!);
    expect(saved.drill.tuning.includeOffConvention).toBe(true);
  });
});

// ─── SSR safety ─────────────────────────────────────────────

describe("SSR safety", () => {
  it("uses defaults when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("SSR"); },
      setItem: () => { throw new Error("SSR"); },
      removeItem: () => { throw new Error("SSR"); },
    });
    const store = createAppStore();
    expect(store.baseSystemId).toBe("sayc");
    expect(store.opponentMode).toBe("natural");
  });
});
