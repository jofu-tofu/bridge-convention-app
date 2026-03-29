import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createAppStore } from "../app.svelte";
import { OpponentMode } from "../../session/drill-types";

const SETTINGS_KEY = "bridge-app:practice-preferences";

const DEFAULTS = {
  baseSystemId: "sayc",
  drill: {
    opponentMode: "none",
    tuning: { vulnerabilityDistribution: { none: 1, ours: 0, theirs: 0, both: 0 } },
  },
  display: { showEducationalAnnotations: true },
};

// Node 25 ships a broken global localStorage that shadows jsdom's.
// Provide a spec-compliant in-memory shim so tests (and production code) work.
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
    expect(store.opponentMode).toBe("none");
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

  it("setBaseSystemId persists acol and round-trips", () => {
    const store = createAppStore();
    store.setBaseSystemId("acol");
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)!);
    expect(saved.baseSystemId).toBe("acol");
    const store2 = createAppStore();
    expect(store2.baseSystemId).toBe("acol");
  });

  it("loads preferences from localStorage on creation", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      ...DEFAULTS,
      baseSystemId: "two-over-one",
      drill: { opponentMode: "none", tuning: DEFAULTS.drill.tuning },
    }));
    const store = createAppStore();
    expect(store.baseSystemId).toBe("two-over-one");
    expect(store.opponentMode).toBe("none");
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

  it("invalid opponentMode falls back to none", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      ...DEFAULTS, drill: { opponentMode: "aggressive", tuning: DEFAULTS.drill.tuning },
    }));
    expect(createAppStore().opponentMode).toBe("none");
  });

  it("invalid vulnerabilityDistribution falls back to default", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      ...DEFAULTS,
      drill: { opponentMode: "natural", tuning: { vulnerabilityDistribution: { none: 1 } } },
    }));
    expect(createAppStore().drillTuning.vulnerabilityDistribution).toEqual({
      none: 1, ours: 0, theirs: 0, both: 0,
    });
  });

  it("partial preferences are filled with defaults", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ drill: { opponentMode: "none" } }));
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
    store.setOpponentMode(OpponentMode.None);
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
    expect(store.opponentMode).toBe("none");
  });
});
