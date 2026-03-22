import type { createAppStore } from "./app.svelte";
import { getConvention } from "../conventions";

export function applyDevParams(store: ReturnType<typeof createAppStore>): void {
  const params = new URLSearchParams(window.location.search);

  // Coverage page — show targetable FSM states
  // ?coverage=true           → bundle picker
  // ?coverage=true&convention=X → that bundle's coverage targets
  const coverageParam = params.get("coverage");
  if (coverageParam === "true") {
    const coverageConvention = params.get("convention");
    if (coverageConvention) {
      store.setCoverageBundle(coverageConvention);
    }
    store.navigateToCoverage();
    return;
  }

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
  const targetStateParam = params.get("targetState");

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

  // Target state: drop into a specific FSM state for coverage testing
  // Requires ?convention= to also be set so we know which bundle to target
  if (targetStateParam) {
    store.setTargetState(targetStateParam);
  }

  // Target surface: exercise a specific meaning surface at the target state
  // Requires ?targetState= to also be set
  const targetSurfaceParam = params.get("targetSurface");
  if (targetSurfaceParam) {
    store.setTargetSurface(targetSurfaceParam);
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
