import { describe, it, expect } from "vitest";
import { createAppStore } from "../app.svelte";
import { staymanConfig } from "../../conventions/definitions/stayman";
import { gerberConfig } from "../../conventions/definitions/gerber";

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
    store.navigateToLearning(gerberConfig);
    expect(store.selectedConvention).toBeNull();
    expect(store.learningConvention?.id).toBe("gerber");
  });

  it("selectConvention clears learningConvention", () => {
    const store = createAppStore();
    store.navigateToLearning(staymanConfig);
    expect(store.learningConvention).not.toBeNull();
    store.selectConvention(gerberConfig);
    expect(store.learningConvention).toBeNull();
    expect(store.selectedConvention?.id).toBe("gerber");
  });
});
