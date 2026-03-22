import { describe, it, expect } from "vitest";
import { createAppStore } from "../app.svelte";
import { createConventionConfigFromBundle, ntBundle, bergenBundle } from "../../conventions";

const ntBundleConventionConfig = createConventionConfigFromBundle(ntBundle);
const bergenBundleConventionConfig = createConventionConfigFromBundle(bergenBundle);

describe("app store learning navigation", () => {
  it("learningConvention is null initially", () => {
    const store = createAppStore();
    expect(store.learningConvention).toBeNull();
  });

  it("navigateToLearning sets screen and learningConvention", () => {
    const store = createAppStore();
    store.navigateToLearning(ntBundleConventionConfig);
    expect(store.screen).toBe("learning");
    expect(store.learningConvention?.id).toBe("nt-bundle");
  });

  it("navigateToMenu from learning clears learningConvention", () => {
    const store = createAppStore();
    store.navigateToLearning(ntBundleConventionConfig);
    store.navigateToMenu();
    expect(store.screen).toBe("select");
    expect(store.learningConvention).toBeNull();
  });

  it("navigateToLearning clears selectedConvention", () => {
    const store = createAppStore();
    store.selectConvention(ntBundleConventionConfig);
    expect(store.selectedConvention).not.toBeNull();
    store.navigateToLearning(bergenBundleConventionConfig);
    expect(store.selectedConvention).toBeNull();
    expect(store.learningConvention?.id).toBe("bergen-bundle");
  });

  it("selectConvention clears learningConvention", () => {
    const store = createAppStore();
    store.navigateToLearning(ntBundleConventionConfig);
    expect(store.learningConvention).not.toBeNull();
    store.selectConvention(bergenBundleConventionConfig);
    expect(store.learningConvention).toBeNull();
    expect(store.selectedConvention?.id).toBe("bergen-bundle");
  });
});
