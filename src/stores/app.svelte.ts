import type { ConventionConfig } from "../conventions/core";
import type { OpponentMode, DrillTuning, VulnerabilityDistribution } from "../core/contracts/drill";
import { DEFAULT_DRILL_TUNING } from "../core/contracts/drill";
import type { BaseSystemId } from "../core/contracts/base-system-vocabulary";
import type { PracticePreferences, DisplayPreferences } from "../core/contracts/practice-preferences";
import { DEFAULT_PRACTICE_PREFERENCES, DEFAULT_DISPLAY_PREFERENCES } from "../core/contracts/practice-preferences";
import { AVAILABLE_BASE_SYSTEMS } from "../core/contracts/system-config";

export type Screen = "select" | "game" | "learning" | "settings" | "coverage";

// ─── Persistence ────────────────────────────────────────────

const SETTINGS_KEY = "bridge-app:practice-preferences";

// Legacy keys — read once during migration, then ignored.
const LEGACY_KEYS = [
  "bridge-app:opponent-mode",
  "bridge-app:drill-tuning",
  "bridge-app:display-settings",
  "bridge-app:base-system",
  "bridge-app:settings", // previous unified key before rename
] as const;

function loadPreferences(): PracticePreferences {
  try {
    // Prefer the current key
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return mergePreferences(JSON.parse(raw) as Partial<PracticePreferences>);
    }

    // Try previous unified key
    const prev = localStorage.getItem("bridge-app:settings");
    if (prev) {
      const prefs = mergePreferences(remapLegacyBlob(JSON.parse(prev)));
      savePreferences(prefs);
      localStorage.removeItem("bridge-app:settings");
      return prefs;
    }

    // Migrate from legacy scattered keys
    const migrated = migrateLegacyKeys();
    if (migrated) {
      savePreferences(migrated);
      for (const key of LEGACY_KEYS) localStorage.removeItem(key);
      return migrated;
    }
  } catch { /* SSR or storage unavailable */ }
  return DEFAULT_PRACTICE_PREFERENCES;
}

/** Remap the previous UserSettings shape (displaySettings → display). */
function remapLegacyBlob(blob: Record<string, unknown>): Partial<PracticePreferences> {
  const result = { ...blob } as Record<string, unknown>;
  if ("displaySettings" in result && !("display" in result)) {
    result.display = result.displaySettings;
    delete result.displaySettings;
  }
  return result as Partial<PracticePreferences>;
}

function migrateLegacyKeys(): PracticePreferences | null {
  try {
    let found = false;
    let opponentMode: OpponentMode = DEFAULT_PRACTICE_PREFERENCES.opponentMode;
    let baseSystemId: BaseSystemId = DEFAULT_PRACTICE_PREFERENCES.baseSystemId;
    let drillTuning: DrillTuning = DEFAULT_PRACTICE_PREFERENCES.drillTuning;
    let display: DisplayPreferences = DEFAULT_PRACTICE_PREFERENCES.display;

    const opp = localStorage.getItem("bridge-app:opponent-mode");
    if (opp === "none" || opp === "natural") { opponentMode = opp; found = true; }

    const sys = localStorage.getItem("bridge-app:base-system");
    if (sys && AVAILABLE_BASE_SYSTEMS.some((s) => s.id === sys)) { baseSystemId = sys as BaseSystemId; found = true; }

    const tuningRaw = localStorage.getItem("bridge-app:drill-tuning");
    if (tuningRaw) {
      const parsed = JSON.parse(tuningRaw) as Partial<DrillTuning>;
      const vd = parsed.vulnerabilityDistribution;
      if (
        vd &&
        typeof vd.none === "number" && typeof vd.ours === "number" &&
        typeof vd.theirs === "number" && typeof vd.both === "number"
      ) {
        drillTuning = { ...DEFAULT_DRILL_TUNING, ...parsed, vulnerabilityDistribution: vd };
        found = true;
      }
    }

    const dispRaw = localStorage.getItem("bridge-app:display-settings");
    if (dispRaw) {
      const parsed = JSON.parse(dispRaw) as Partial<DisplayPreferences>;
      display = { ...DEFAULT_DISPLAY_PREFERENCES, ...parsed };
      found = true;
    }

    return found ? { baseSystemId, opponentMode, drillTuning, display } : null;
  } catch { return null; }
}

/** Merge a partial persisted blob with defaults. */
function mergePreferences(partial: Partial<PracticePreferences>): PracticePreferences {
  const vd = partial.drillTuning?.vulnerabilityDistribution;
  const validVd = vd &&
    typeof vd.none === "number" && typeof vd.ours === "number" &&
    typeof vd.theirs === "number" && typeof vd.both === "number";

  return {
    baseSystemId:
      (partial.baseSystemId && AVAILABLE_BASE_SYSTEMS.some((s) => s.id === partial.baseSystemId))
        ? partial.baseSystemId as BaseSystemId
        : DEFAULT_PRACTICE_PREFERENCES.baseSystemId,
    opponentMode:
      partial.opponentMode === "none" || partial.opponentMode === "natural"
        ? partial.opponentMode
        : DEFAULT_PRACTICE_PREFERENCES.opponentMode,
    drillTuning: {
      ...DEFAULT_DRILL_TUNING,
      ...partial.drillTuning,
      vulnerabilityDistribution: validVd ? vd! : DEFAULT_DRILL_TUNING.vulnerabilityDistribution,
    },
    display: {
      ...DEFAULT_DISPLAY_PREFERENCES,
      ...partial.display,
    },
  };
}

function savePreferences(prefs: PracticePreferences) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

// ─── Store ──────────────────────────────────────────────────

export function createAppStore() {
  let currentScreen = $state<Screen>("select");
  let selectedConvention = $state<ConventionConfig | null>(null);
  let devSeed = $state<number | null>(null);
  let devDealCount = $state(0);
  let debugPanelOpen = $state(false);
  let engineStatus = $state<string | null>(null);
  let engineError = $state<string | null>(null);
  let learningConvention = $state<ConventionConfig | null>(null);
  let autoplay = $state(false);
  let targetState = $state<string | null>(null);
  let targetSurface = $state<string | null>(null);
  let coverageBundle = $state<string | null>(null);

  // All persisted practice preferences — single blob
  let prefs = $state<PracticePreferences>(loadPreferences());

  function updatePrefs(patch: Partial<PracticePreferences>) {
    prefs = { ...prefs, ...patch };
    savePreferences(prefs);
  }

  return {
    get screen() {
      return currentScreen;
    },
    get selectedConvention() {
      return selectedConvention;
    },
    get learningConvention() {
      return learningConvention;
    },
    get devSeed() {
      return devSeed;
    },
    get devDealCount() {
      return devDealCount;
    },

    selectConvention(config: ConventionConfig) {
      selectedConvention = config;
      learningConvention = null;
      currentScreen = "game";
    },

    navigateToLearning(config: ConventionConfig) {
      learningConvention = config;
      selectedConvention = null;
      currentScreen = "learning";
    },

    navigateToMenu() {
      selectedConvention = null;
      learningConvention = null;
      currentScreen = "select";
    },

    navigateToSettings() {
      currentScreen = "settings";
    },

    navigateToCoverage() {
      currentScreen = "coverage";
    },

    setDevSeed(seed: number | null) {
      devSeed = seed;
      devDealCount = 0;
    },

    advanceDevDeal() {
      devDealCount++;
    },

    get debugPanelOpen() {
      return debugPanelOpen;
    },

    toggleDebugPanel() {
      debugPanelOpen = !debugPanelOpen;
    },

    setDebugPanel(open: boolean) {
      debugPanelOpen = open;
    },

    get engineStatus() {
      return engineStatus;
    },

    setEngineStatus(status: string) {
      engineStatus = status;
    },

    get engineError() {
      return engineError;
    },

    setEngineError(msg: string | null) {
      engineError = msg;
    },

    get autoplay() {
      return autoplay;
    },

    setAutoplay(on: boolean) {
      autoplay = on;
    },

    get opponentMode() {
      return prefs.opponentMode;
    },

    setOpponentMode(mode: OpponentMode) {
      updatePrefs({ opponentMode: mode });
    },

    get baseSystemId() {
      return prefs.baseSystemId;
    },

    setBaseSystemId(id: BaseSystemId) {
      updatePrefs({ baseSystemId: id });
    },

    get drillTuning() {
      return prefs.drillTuning;
    },

    setVulnerabilityDistribution(dist: VulnerabilityDistribution) {
      updatePrefs({ drillTuning: { ...prefs.drillTuning, vulnerabilityDistribution: dist } });
    },

    setIncludeOffConvention(include: boolean) {
      updatePrefs({ drillTuning: { ...prefs.drillTuning, includeOffConvention: include } });
    },

    setOffConventionRate(rate: number) {
      updatePrefs({ drillTuning: { ...prefs.drillTuning, offConventionRate: Math.max(0, Math.min(1, rate)) } });
    },

    get displaySettings() {
      return prefs.display;
    },

    setShowEducationalAnnotations(show: boolean) {
      updatePrefs({ display: { ...prefs.display, showEducationalAnnotations: show } });
    },

    get targetState() {
      return targetState;
    },

    setTargetState(state: string | null) {
      targetState = state;
    },

    get targetSurface() {
      return targetSurface;
    },

    setTargetSurface(surface: string | null) {
      targetSurface = surface;
    },

    get coverageBundle() {
      return coverageBundle;
    },

    setCoverageBundle(bundleId: string | null) {
      coverageBundle = bundleId;
    },
  };
}
