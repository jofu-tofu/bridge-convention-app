import { describe, it, expect } from "vitest";
import { createAppStore } from "../app.svelte";

describe("app store debug panel state", () => {
  it("starts with debugPanelOpen = false", () => {
    const store = createAppStore();
    expect(store.debugPanelOpen).toBe(false);
  });

  it("toggleDebugPanel flips state", () => {
    const store = createAppStore();
    store.toggleDebugPanel();
    expect(store.debugPanelOpen).toBe(true);
    store.toggleDebugPanel();
    expect(store.debugPanelOpen).toBe(false);
  });

  it("setDebugPanel(true) opens, setDebugPanel(false) closes", () => {
    const store = createAppStore();
    store.setDebugPanel(true);
    expect(store.debugPanelOpen).toBe(true);
    store.setDebugPanel(false);
    expect(store.debugPanelOpen).toBe(false);
  });
});
