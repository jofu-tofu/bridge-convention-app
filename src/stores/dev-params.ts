import type { createAppStore } from "./app.svelte";
import { ConventionCategory, PracticeMode, PracticeRole, SubscriptionTier } from "../service";
import type { ConventionInfo } from "../service";
import { listConventions } from "../service/service-helpers";

/**
 * Consolidated URL parameter API for deep-linking and dev/test workflows.
 *
 * Universal params (all builds):
 *   ?convention=<id>       Select convention → game screen
 *   ?learn=<id>            Module or bundle → learning screen
 *   ?seed=<number>         Deterministic PRNG seed
 *   ?screen=<name>         Direct screen nav: settings | coverage | workshop
 *   ?phase=<name>          Skip to game phase: review | playing | declarer
 *   ?targetState=<id>      FSM state targeting (coverage)
 *   ?targetSurface=<id>    Meaning surface targeting (coverage)
 *
 * Dev-only params (DEV build):
 *   ?dev=<flags>           Comma-separated: debug, expanded, autoplay, autoDismiss
 *
 * Backward compat alias:
 *   ?profiles=true         → ?screen=workshop
 */
export function applyDevParams(store: ReturnType<typeof createAppStore>): void {
  const params = new URLSearchParams(window.location.search);

  // ── Screen navigation ──────────────────────────────────────
  // ?screen= is the canonical param; ?profiles=true is a backward compat alias
  const screenParam = params.get("screen")
    ?? (params.get("profiles") === "true" ? "workshop" : null);

  if (screenParam === "coverage") {
    const coverageConvention = params.get("convention");
    if (coverageConvention) {
      store.setCoverageBundle(coverageConvention);
    }
    store.navigateToCoverage();
    return;
  }
  if (screenParam === "workshop") {
    store.navigateToWorkshop();
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

  const conventionParam = params.get("convention");

  // ── Practice mode/role (must be set BEFORE selectConvention) ──
  // Deep links should land in the game screen. When a convention or phase is
  // specified without an explicit practiceMode, default to decision-drill.
  const phaseParam = params.get("phase");
  const practiceModeParam = params.get("practiceMode")
    ?? ((phaseParam || conventionParam) ? PracticeMode.DecisionDrill : null);
  if (practiceModeParam === PracticeMode.DecisionDrill || practiceModeParam === PracticeMode.FullAuction) {
    store.setPracticeMode(practiceModeParam);
  }

  const practiceRoleParam = params.get("practiceRole");
  if (practiceRoleParam === PracticeRole.Opener || practiceRoleParam === PracticeRole.Responder || practiceRoleParam === PracticeRole.Both) {
    store.setDevPracticeRole(practiceRoleParam);
  }

  // ── Convention / Learn deep links ──────────────────────────
  const learnParam = params.get("learn");

  if (learnParam) {
    // Module-first resolution: navigate by module ID
    // Convention catalog is now in Rust/WASM — resolve via store methods
    store.navigateToLearningModule(learnParam);
  } else if (conventionParam) {
    // Resolve from catalog for proper display name; fall back to stub for unknown IDs
    const conventions = listConventions();
    const catalogMatch: ConventionInfo | undefined = conventions.find(c => c.id === conventionParam);
    if (catalogMatch) {
      store.selectConvention(catalogMatch);
    } else {
      const fallbackConvention: ConventionInfo = {
        id: conventionParam,
        name: conventionParam,
        description: "",
        category: ConventionCategory.Asking,
      };
      store.selectConvention(fallbackConvention);
    }
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
  if (phaseParam === "review" || phaseParam === "playing" || phaseParam === "declarer") {
    store.setSkipToPhase(phaseParam);
  }

  // ── Dev flags (DEV builds only) ────────────────────────────
  if (!import.meta.env.DEV) return;

  // Parse ?dev= comma-separated flags
  const devParam = params.get("dev");
  const devFlags = new Set(devParam ? devParam.split(",").map(f => f.trim()) : []);

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

/**
 * Parse dev auth override from URL params. Returns null in production builds
 * or when no auth override is specified.
 *
 * Usage: ?dev=auth:free | ?dev=auth:premium | ?dev=auth:expired
 */
export function getDevAuthOverride(): SubscriptionTier | null {
  if (!import.meta.env.DEV) return null;

  const params = new URLSearchParams(window.location.search);
  const devParam = params.get("dev");
  if (!devParam) return null;

  const flags = devParam.split(",").map(f => f.trim());
  const authFlag = flags.find(f => f.startsWith("auth:"));
  if (!authFlag) return null;

  const tier = authFlag.slice(5);
  const validTiers: string[] = Object.values(SubscriptionTier);
  if (validTiers.includes(tier)) {
    return tier as SubscriptionTier;
  }
  return null;
}
