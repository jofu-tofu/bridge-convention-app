import type { ConventionInfo, BaseSystemId, VulnerabilityDistribution, DrillSettings, PlayProfileId, PracticePreferences, DisplayPreferences, PracticeMode, PracticeRole } from "../service";
import { OpponentMode, DEFAULT_DRILL_TUNING, DEFAULT_DRILL_SETTINGS, AVAILABLE_BASE_SYSTEMS, DEFAULT_PRACTICE_PREFERENCES, DEFAULT_DISPLAY_PREFERENCES } from "../service";

export type Screen = "conventions" | "practice-picker" | "game" | "learning" | "settings" | "coverage" | "profiles";

// ─── Persistence ────────────────────────────────────────────

const SETTINGS_KEY = "bridge-app:practice-preferences";

function loadPreferences(): PracticePreferences {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return mergePreferences(JSON.parse(raw) as Record<string, unknown>);
    }
  } catch { /* SSR or storage unavailable */ }
  return DEFAULT_PRACTICE_PREFERENCES;
}

/** Merge a partial persisted blob with defaults. */
function mergePreferences(partial: Record<string, unknown>): PracticePreferences {
  const drill = partial.drill as Partial<DrillSettings> | undefined;
  let opponentMode: OpponentMode = drill?.opponentMode ?? DEFAULT_DRILL_SETTINGS.opponentMode;
  const tuningRaw = drill?.tuning;
  const baseSystemIdRaw = partial.baseSystemId;

  // Validate opponentMode
  if (opponentMode !== OpponentMode.None && opponentMode !== OpponentMode.Natural) {
    opponentMode = DEFAULT_DRILL_SETTINGS.opponentMode;
  }

  // Validate playProfileId
  const VALID_PROFILES = new Set<string>(["beginner", "club-player", "expert", "world-class"]);
  let playProfileId: PlayProfileId | undefined = drill?.playProfileId;
  if (playProfileId && !VALID_PROFILES.has(playProfileId)) {
    playProfileId = undefined;
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
      ...(playProfileId ? { playProfileId } : {}),
      tuning: {
        ...DEFAULT_DRILL_TUNING,
        ...tuningRaw,
        vulnerabilityDistribution: validVd ? vd : DEFAULT_DRILL_TUNING.vulnerabilityDistribution,
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
  let currentScreen = $state<Screen>("conventions");
  let selectedConvention = $state<ConventionInfo | null>(null);
  let devSeed = $state<number | null>(null);
  let devDealCount = $state(0);
  let debugPanelOpen = $state(false);
  let engineStatus = $state<string | null>(null);
  let engineError = $state<string | null>(null);
  let learningConvention = $state<ConventionInfo | null>(null);
  let learningModuleId = $state<string | null>(null);
  let learningBundleFilter = $state<string | null>(null);
  let learningBundleFilterName = $state<string | null>(null);
  let autoplay = $state(false);
  let targetState = $state<string | null>(null);
  let targetSurface = $state<string | null>(null);
  let coverageBundle = $state<string | null>(null);

  // Dev flags parsed from ?dev= comma-separated param
  let debugExpanded = $state(false);
  let autoDismissFeedback = $state(false);
  /** Target phase for instant skip-to-phase (?phase=review|playing|declarer). */
  let skipToPhase = $state<"review" | "playing" | "declarer" | null>(null);
  /** Dev-override practice mode from URL param (?practiceMode=). */
  let devPracticeMode = $state<PracticeMode | null>(null);
  /** User-selected practice mode from PracticeModePicker. */
  let userPracticeMode = $state<PracticeMode | null>(null);
  /** Dev-override practice role from URL param (?practiceRole=). */
  let devPracticeRole = $state<PracticeRole | null>(null);
  /** User-selected practice role from PracticeModePicker. */
  let userPracticeRole = $state<PracticeRole | null>(null);

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
    get learningModuleId() {
      return learningModuleId;
    },
    get learningBundleFilter() {
      return learningBundleFilter;
    },
    get learningBundleFilterName() {
      return learningBundleFilterName;
    },
    get devSeed() {
      return devSeed;
    },
    get devDealCount() {
      return devDealCount;
    },

    selectConvention(config: ConventionInfo) {
      selectedConvention = config;
      learningConvention = null;
      userPracticeMode = null;
      userPracticeRole = null;
      if (devPracticeMode) {
        currentScreen = "game";
      } else {
        currentScreen = "practice-picker";
      }
    },

    confirmPracticeMode(mode: PracticeMode, role?: PracticeRole) {
      userPracticeMode = mode;
      if (role) userPracticeRole = role;
      currentScreen = "game";
    },

    cancelPracticeMode() {
      selectedConvention = null;
      userPracticeMode = null;
      userPracticeRole = null;
      currentScreen = "conventions";
    },

    navigateToLearning(config: ConventionInfo) {
      learningConvention = config;
      selectedConvention = null;
      learningBundleFilter = config.id;
      learningBundleFilterName = config.name;
      // Auto-select first module from the bundle's member ordering
      const firstModuleId = config.moduleDescriptions?.keys().next().value ?? null;
      learningModuleId = firstModuleId ?? null;
      currentScreen = "learning";
    },

    /** Navigate directly to a specific module's learning page. */
    navigateToLearningModule(moduleId: string, bundleFilter?: string, bundleFilterName?: string) {
      learningModuleId = moduleId;
      learningBundleFilter = bundleFilter ?? null;
      learningBundleFilterName = bundleFilterName ?? null;
      learningConvention = null;
      selectedConvention = null;
      currentScreen = "learning";
    },

    selectLearningModule(moduleId: string) {
      learningModuleId = moduleId;
    },

    clearBundleFilter() {
      learningBundleFilter = null;
      learningBundleFilterName = null;
    },

    /** Navigate to learning screen showing all modules, auto-selecting first if none selected. */
    navigateToLearningHome() {
      learningConvention = null;
      selectedConvention = null;
      learningBundleFilter = null;
      learningBundleFilterName = null;
      currentScreen = "learning";
    },

    navigateToConventions() {
      selectedConvention = null;
      learningConvention = null;
      learningModuleId = null;
      learningBundleFilter = null;
      learningBundleFilterName = null;
      currentScreen = "conventions";
    },

    navigateToSettings() {
      currentScreen = "settings";
    },

    navigateToCoverage() {
      currentScreen = "coverage";
    },

    navigateToProfiles() {
      currentScreen = "profiles";
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

    get debugExpanded() {
      return debugExpanded;
    },

    setDebugExpanded(on: boolean) {
      debugExpanded = on;
    },

    get autoDismissFeedback() {
      return autoDismissFeedback;
    },

    setAutoDismissFeedback(on: boolean) {
      autoDismissFeedback = on;
    },

    get devPracticeMode() {
      return devPracticeMode;
    },

    get userPracticeMode() {
      return userPracticeMode;
    },

    setPracticeMode(mode: PracticeMode | null) {
      devPracticeMode = mode;
    },

    get devPracticeRole() {
      return devPracticeRole;
    },

    get userPracticeRole() {
      return userPracticeRole;
    },

    setDevPracticeRole(role: PracticeRole | null) {
      devPracticeRole = role;
    },

    get skipToPhase() {
      return skipToPhase;
    },

    setSkipToPhase(phase: "review" | "playing" | "declarer" | null) {
      skipToPhase = phase;
    },

    get opponentMode() {
      return prefs.drill.opponentMode;
    },

    setOpponentMode(mode: OpponentMode) {
      updateDrill({ opponentMode: mode });
    },

    get playProfileId(): PlayProfileId | undefined {
      return prefs.drill.playProfileId;
    },

    setPlayProfileId(id: PlayProfileId) {
      updateDrill({ playProfileId: id });
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
