import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createAppStore } from "../app.svelte";
import { OpponentMode, PracticeMode, PracticeRole } from "../../service/session-types";

const SETTINGS_KEY = "bridge-app:practice-preferences";

const DEFAULTS = {
  baseSystemId: "sayc",
  drill: {
    opponentMode: "none",
    practiceRole: "auto",
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
    expect(store.practiceRole).toBe("auto");
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
    expect(store.practiceRole).toBe("auto");
    expect(store.baseSystemId).toBe("sayc");
    expect(store.displaySettings.showEducationalAnnotations).toBe(true);
  });

  it("invalid practiceRole falls back to auto", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      ...DEFAULTS,
      drill: { ...DEFAULTS.drill, practiceRole: "dealer" },
    }));

    expect(createAppStore().practiceRole).toBe("auto");
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

  it("setPracticeRole changes value and persists", () => {
    const store = createAppStore();

    store.setPracticeRole(PracticeRole.Opener);

    expect(store.practiceRole).toBe(PracticeRole.Opener);
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)!);
    expect(saved.drill.practiceRole).toBe(PracticeRole.Opener);
  });

  it("setVulnerabilityDistribution changes distribution", () => {
    const store = createAppStore();
    const dist = { none: 0, ours: 1, theirs: 1, both: 0 };
    store.setVulnerabilityDistribution(dist);
    expect(store.drillTuning.vulnerabilityDistribution).toEqual(dist);
  });

  it("setShowEducationalAnnotations changes display preference", () => {
    const store = createAppStore();
    expect(store.displaySettings.showEducationalAnnotations).toBe(true);
    store.setShowEducationalAnnotations(false);
    expect(store.displaySettings.showEducationalAnnotations).toBe(false);
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)!);
    expect(saved.display.showEducationalAnnotations).toBe(false);
  });

  it("applyDrillSession updates launch state without overwriting persisted preferences", () => {
    const store = createAppStore();
    store.setPracticeRole("auto");
    store.setBaseSystemId("sayc");

    const persistedBeforeLaunch = localStorage.getItem(SETTINGS_KEY);

    store.applyDrillSession(
      {
        moduleIds: ["stayman"],
        practiceMode: PracticeMode.FullAuction,
        practiceRole: "auto",
        systemSelectionId: "two-over-one",
        sourceDrillId: "drill:stayman",
      },
      [
        {
          id: "stayman",
          name: "Stayman",
          description: "Find a major after 1NT.",
          defaultRole: PracticeRole.Responder,
        },
      ],
    );

    expect(store.activeLaunch?.sourceDrillId).toBe("drill:stayman");
    expect(store.userPracticeMode).toBe(PracticeMode.FullAuction);
    expect(store.practiceRole).toBe(PracticeRole.Responder);
    expect(store.baseSystemId).toBe("two-over-one");
    expect(localStorage.getItem(SETTINGS_KEY)).toBe(persistedBeforeLaunch);
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
