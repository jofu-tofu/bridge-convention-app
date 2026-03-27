import type { createAppStore } from "./app.svelte";
import { getConvention, getModule } from "../service";

/**
 * Consolidated URL parameter API for deep-linking and dev/test workflows.
 *
 * Universal params (all builds):
 *   ?convention=<id>       Select convention → game screen
 *   ?learn=<id>            Module or bundle → learning screen
 *   ?seed=<number>         Deterministic PRNG seed
 *   ?screen=<name>         Direct screen nav: settings | coverage | profiles
 *   ?phase=<name>          Skip to game phase: review | playing | declarer
 *   ?targetState=<id>      FSM state targeting (coverage)
 *   ?targetSurface=<id>    Meaning surface targeting (coverage)
 *
 * Dev-only params (DEV build):
 *   ?dev=<flags>           Comma-separated: debug, expanded, autoplay, autoDismiss
 *
 * Backward compat aliases (mapped to consolidated params):
 *   ?coverage=true         → ?screen=coverage
 *   ?profiles=true         → ?screen=profiles
 *   ?debug=true            → ?dev=debug
 *   ?autoplay=true         → ?dev=autoplay
 */
export function applyDevParams(store: ReturnType<typeof createAppStore>): void {
  const params = new URLSearchParams(window.location.search);

  // ── Screen navigation ──────────────────────────────────────
  // ?screen= is the canonical param; ?coverage=true and ?profiles=true are aliases
  const screenParam = params.get("screen")
    ?? (params.get("coverage") === "true" ? "coverage" : null)
    ?? (params.get("profiles") === "true" ? "profiles" : null);

  if (screenParam === "coverage") {
    const coverageConvention = params.get("convention");
    if (coverageConvention) {
      store.setCoverageBundle(coverageConvention);
    }
    store.navigateToCoverage();
    return;
  }
  if (screenParam === "profiles") {
    store.navigateToProfiles();
    return;
  }
  if (screenParam === "settings") {
    store.navigateToSettings();
    return;
  }

  // ── Seed (universal) ───────────────────────────────────────
  const seedParam = params.get("seed");
  if (seedParam !== null) {
    const seed = Number(seedParam);
    if (Number.isFinite(seed)) {
      store.setDevSeed(seed);
    }
  }

  // ── Convention / Learn deep links ──────────────────────────
  const conventionParam = params.get("convention");
  const learnParam = params.get("learn");

  if (learnParam) {
    // Module-first resolution: try module ID first, then bundle ID
    const mod = getModule(learnParam);
    if (mod) {
      store.navigateToLearningModule(learnParam);
    } else {
      try {
        const config = getConvention(learnParam);
        store.navigateToLearning(config);
      } catch {
        // Invalid param — silently ignore
      }
    }
  } else if (conventionParam) {
    try {
      const config = getConvention(conventionParam);
      store.selectConvention(config);
    } catch {
      // Invalid param — silently ignore
    }
  }

  // ── Practice mode ─────────────────────────────────────────
  const practiceModeParam = params.get("practiceMode");
  if (practiceModeParam === "decision-drill" || practiceModeParam === "full-auction" || practiceModeParam === "continuation-drill") {
    store.setPracticeMode(practiceModeParam);
  }

  // ── Practice role ──────────────────────────────────────────
  const practiceRoleParam = params.get("practiceRole");
  if (practiceRoleParam === "opener" || practiceRoleParam === "responder" || practiceRoleParam === "both") {
    store.setDevPracticeRole(practiceRoleParam);
  }

  // ── Coverage targeting ─────────────────────────────────────
  const targetStateParam = params.get("targetState");
  if (targetStateParam) {
    store.setTargetState(targetStateParam);
  }

  const targetSurfaceParam = params.get("targetSurface");
  if (targetSurfaceParam) {
    store.setTargetSurface(targetSurfaceParam);
  }

  // ── Phase skip (universal — works in prod for shareable links) ──
  const phaseParam = params.get("phase");
  if (phaseParam === "review" || phaseParam === "playing" || phaseParam === "declarer") {
    store.setSkipToPhase(phaseParam);
  }

  // ── Dev flags (DEV builds only) ────────────────────────────
  if (!import.meta.env.DEV) return;

  // Parse ?dev= comma-separated flags + backward compat aliases
  const devParam = params.get("dev");
  const devFlags = new Set(devParam ? devParam.split(",").map(f => f.trim()) : []);

  // Backward compat: ?debug=true → dev=debug, ?autoplay=true → dev=autoplay
  if (params.get("debug") === "true") devFlags.add("debug");
  if (params.get("autoplay") === "true") devFlags.add("autoplay");

  if (devFlags.has("debug")) {
    store.setDebugPanel(true);
  }
  if (devFlags.has("expanded")) {
    store.setDebugPanel(true); // expanded implies debug open
    store.setDebugExpanded(true);
  }
  if (devFlags.has("autoplay")) {
    store.setAutoplay(true);
  }
  if (devFlags.has("autoDismiss")) {
    store.setAutoDismissFeedback(true);
  }
}
