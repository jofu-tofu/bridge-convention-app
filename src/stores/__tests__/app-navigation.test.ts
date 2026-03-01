import { describe, it, expect } from "vitest";
import { createAppStore } from "../app.svelte";
import { staymanConfig } from "../../conventions/definitions/stayman";
import { bergenConfig } from "../../conventions/definitions/bergen-raises";

describe("app store learning navigation", () => {
  it("learningConvention is null initially", () => {
    const store = createAppStore();
    expect(store.learningConvention).toBeNull();
  });

  it("navigateToLearning sets screen and learningConvention", () => {
    const store = createAppStore();
    store.navigateToLearning(staymanConfig);
    expect(store.screen).toBe("learning");
    expect(store.learningConvention?.id).toBe("stayman");
  });

  it("navigateToMenu from learning clears learningConvention", () => {
    const store = createAppStore();
    store.navigateToLearning(staymanConfig);
    store.navigateToMenu();
    expect(store.screen).toBe("select");
    expect(store.learningConvention).toBeNull();
  });

  it("navigateToLearning clears selectedConvention", () => {
    const store = createAppStore();
    store.selectConvention(staymanConfig);
    expect(store.selectedConvention).not.toBeNull();
    store.navigateToLearning(bergenConfig);
    expect(store.selectedConvention).toBeNull();
    expect(store.learningConvention?.id).toBe("bergen-raises");
  });

  it("selectConvention clears learningConvention", () => {
    const store = createAppStore();
    store.navigateToLearning(staymanConfig);
    expect(store.learningConvention).not.toBeNull();
    store.selectConvention(bergenConfig);
    expect(store.learningConvention).toBeNull();
    expect(store.selectedConvention?.id).toBe("bergen-raises");
  });
});
