import type { ConventionConfig } from "../conventions/core";
import type { OpponentMode, DrillTuning, VulnerabilityDistribution, DrillSettings } from "../core/contracts/drill";
import { DEFAULT_DRILL_TUNING, DEFAULT_DRILL_SETTINGS } from "../core/contracts/drill";
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
      return mergePreferences(JSON.parse(raw) as Record<string, unknown>);
    }

    // Try previous unified key
    const prev = localStorage.getItem("bridge-app:settings");
    if (prev) {
      const prefs = mergePreferences(remapLegacyBlob(JSON.parse(prev) as Record<string, unknown>));
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
function remapLegacyBlob(blob: Record<string, unknown>): Record<string, unknown> {
  const result = { ...blob };
  if ("displaySettings" in result && !("display" in result)) {
    result.display = result.displaySettings;
    delete result.displaySettings;
  }
  return result;
}

function migrateLegacyKeys(): PracticePreferences | null {
  try {
    let found = false;
    let opponentMode: OpponentMode = DEFAULT_DRILL_SETTINGS.opponentMode;
    let baseSystemId: BaseSystemId = DEFAULT_PRACTICE_PREFERENCES.baseSystemId;
    let drillTuning: DrillTuning = DEFAULT_DRILL_SETTINGS.tuning;
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

    return found ? { baseSystemId, drill: { opponentMode, tuning: drillTuning }, display } : null;
  } catch { return null; }
}

/** Merge a partial persisted blob with defaults.
 *  Handles both the old flat shape (baseSystemId, opponentMode, drillTuning at top level)
 *  and the new nested shape (drill: { opponentMode, tuning }). */
function mergePreferences(partial: Record<string, unknown>): PracticePreferences {
  // Detect legacy flat shape: opponentMode/drillTuning at top level instead of under drill
  const isLegacyFlat = !partial.drill && ("opponentMode" in partial || "drillTuning" in partial);

  let opponentMode: OpponentMode;
  let tuningRaw: Partial<DrillTuning> | undefined;
  let baseSystemIdRaw: unknown;

  if (isLegacyFlat) {
    opponentMode = partial.opponentMode as OpponentMode ?? DEFAULT_DRILL_SETTINGS.opponentMode;
    tuningRaw = partial.drillTuning as Partial<DrillTuning> | undefined;
    baseSystemIdRaw = partial.baseSystemId;
  } else {
    const drill = partial.drill as Partial<DrillSettings> | undefined;
    opponentMode = drill?.opponentMode ?? DEFAULT_DRILL_SETTINGS.opponentMode;
    tuningRaw = drill?.tuning;
    baseSystemIdRaw = partial.baseSystemId;
  }

  // Validate opponentMode
  if (opponentMode !== "none" && opponentMode !== "natural") {
    opponentMode = DEFAULT_DRILL_SETTINGS.opponentMode;
  }

  // Validate vulnerability distribution
  const vd = tuningRaw?.vulnerabilityDistribution;
  const validVd = vd &&
    typeof vd.none === "number" && typeof vd.ours === "number" &&
    typeof vd.theirs === "number" && typeof vd.both === "number";

  // Validate baseSystemId
  const baseSystemId =
    (baseSystemIdRaw && AVAILABLE_BASE_SYSTEMS.some((s) => s.id === baseSystemIdRaw))
      ? baseSystemIdRaw as BaseSystemId
      : DEFAULT_PRACTICE_PREFERENCES.baseSystemId;

  return {
    baseSystemId,
    drill: {
      opponentMode,
      tuning: {
        ...DEFAULT_DRILL_TUNING,
        ...tuningRaw,
        vulnerabilityDistribution: validVd ? vd! : DEFAULT_DRILL_TUNING.vulnerabilityDistribution,
      },
    },
    display: {
      ...DEFAULT_DISPLAY_PREFERENCES,
      ...(partial.display as Partial<DisplayPreferences> | undefined),
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

  function updateDrill(patch: Partial<DrillSettings>) {
    prefs = { ...prefs, drill: { ...prefs.drill, ...patch } };
    savePreferences(prefs);
  }

  function updateDisplay(patch: Partial<DisplayPreferences>) {
    prefs = { ...prefs, display: { ...prefs.display, ...patch } };
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
      return prefs.drill.opponentMode;
    },

    setOpponentMode(mode: OpponentMode) {
      updateDrill({ opponentMode: mode });
    },

    get baseSystemId() {
      return prefs.baseSystemId;
    },

    setBaseSystemId(id: BaseSystemId) {
      prefs = { ...prefs, baseSystemId: id };
      savePreferences(prefs);
    },

    get drillTuning() {
      return prefs.drill.tuning;
    },

    /** Clean extraction of all drill execution params — backend-ready. */
    get drillSettings(): DrillSettings {
      return prefs.drill;
    },

    setVulnerabilityDistribution(dist: VulnerabilityDistribution) {
      updateDrill({ tuning: { ...prefs.drill.tuning, vulnerabilityDistribution: dist } });
    },

    setIncludeOffConvention(include: boolean) {
      updateDrill({ tuning: { ...prefs.drill.tuning, includeOffConvention: include } });
    },

    setOffConventionRate(rate: number) {
      updateDrill({ tuning: { ...prefs.drill.tuning, offConventionRate: Math.max(0, Math.min(1, rate)) } });
    },

    get displaySettings() {
      return prefs.display;
    },

    setShowEducationalAnnotations(show: boolean) {
      updateDisplay({ showEducationalAnnotations: show });
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
