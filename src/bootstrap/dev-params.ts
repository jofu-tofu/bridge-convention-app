import type { createAppStore } from "../stores/app.svelte";
import { getConvention } from "../conventions/core";

export function applyDevParams(store: ReturnType<typeof createAppStore>): void {
  const params = new URLSearchParams(window.location.search);

  // Seed parameter works in all modes — enables reproducible deals for sharing/debugging
  const seedParam = params.get("seed");
  if (seedParam !== null) {
    const seed = Number(seedParam);
    if (Number.isFinite(seed)) {
      store.setDevSeed(seed);
    }
  }

  // Convention/learn URL params work in all modes for deep linking
  const conventionParam = params.get("convention");
  const learnParam = params.get("learn");
  if (learnParam) {
    try {
      const config = getConvention(learnParam);
      store.navigateToLearning(config);
    } catch {
      // Invalid param — silently ignore
    }
  } else if (conventionParam) {
    try {
      const config = getConvention(conventionParam);
      store.selectConvention(config);
    } catch {
      // Invalid param — silently ignore
    }
  }

  // Debug-only params (debug panel, autoplay) stay DEV-only
  if (!import.meta.env.DEV) return;

  const debugParam = params.get("debug");
  if (debugParam === "true") {
    store.setDebugPanel(true);
  }

  const autoplayParam = params.get("autoplay");
  if (autoplayParam === "true") {
    store.setAutoplay(true);
  }
}
