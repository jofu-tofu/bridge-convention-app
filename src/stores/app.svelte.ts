import type { ConventionInfo, SystemSelectionId, VulnerabilityDistribution, DrillSettings, PlayProfileId, PracticePreferences, DisplayPreferences, PracticeMode, PracticeRole } from "../service";
import { OpponentMode, DEFAULT_DRILL_TUNING, DEFAULT_DRILL_SETTINGS, AVAILABLE_BASE_SYSTEMS, DEFAULT_PRACTICE_PREFERENCES, DEFAULT_DISPLAY_PREFERENCES } from "../service";
import { loadFromStorage, saveToStorage } from "./local-storage";

export type Screen = "conventions" | "game" | "learning" | "settings" | "coverage" | "profiles" | "workshop" | "convention-editor" | "practice-pack-editor";

// ─── Persistence ────────────────────────────────────────────

const SETTINGS_KEY = "bridge-app:practice-preferences";
const LAST_CONVENTION_KEY = "bridge-app:last-convention";

function loadPreferences(): PracticePreferences {
  return loadFromStorage(SETTINGS_KEY, DEFAULT_PRACTICE_PREFERENCES, (raw) => {
    if (raw && typeof raw === "object") {
      return mergePreferences(raw as Record<string, unknown>);
    }
    return undefined;
  });
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

  // Validate baseSystemId — presets or custom:* format
  let baseSystemId: SystemSelectionId;
  if (typeof baseSystemIdRaw === "string" && baseSystemIdRaw.startsWith("custom:")) {
    baseSystemId = baseSystemIdRaw as SystemSelectionId;
  } else if (baseSystemIdRaw && AVAILABLE_BASE_SYSTEMS.some((s) => s.id === baseSystemIdRaw)) {
    baseSystemId = baseSystemIdRaw as SystemSelectionId;
  } else {
    baseSystemId = DEFAULT_PRACTICE_PREFERENCES.baseSystemId;
  }

  // Validate practiceMode
  const VALID_PRACTICE_MODES = new Set<string>(["decision-drill", "full-auction"]);
  const practiceMode = drill?.practiceMode && VALID_PRACTICE_MODES.has(drill.practiceMode) ? drill.practiceMode : undefined;

  // Validate practiceRole
  const VALID_PRACTICE_ROLES = new Set<string>(["responder", "opener", "both"]);
  const practiceRole = drill?.practiceRole && VALID_PRACTICE_ROLES.has(drill.practiceRole) ? drill.practiceRole : undefined;

  return {
    baseSystemId,
    drill: {
      opponentMode,
      ...(playProfileId ? { playProfileId } : {}),
      ...(practiceMode ? { practiceMode } : {}),
      ...(practiceRole ? { practiceRole } : {}),
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
  saveToStorage(SETTINGS_KEY, prefs);
}

// ─── Store ──────────────────────────────────────────────────

export function createAppStore() {
  let currentScreen = $state<Screen>("conventions");
  let selectedConvention = $state<ConventionInfo | null>(null);
  let lastPracticedId = $state<string | null>(loadLastConvention());

  function loadLastConvention(): string | null {
    try { return localStorage.getItem(LAST_CONVENTION_KEY); } catch { return null; }
  }

  function saveLastConvention(id: string) {
    lastPracticedId = id;
    try { localStorage.setItem(LAST_CONVENTION_KEY, id); } catch { /* ignore */ }
  }
  let devSeed = $state<number | null>(null);
  let devDealCount = $state(0);
  let debugPanelOpen = $state(false);
  let learningConvention = $state<ConventionInfo | null>(null);
  let learningModuleId = $state<string | null>(null);
  let learningBundleFilter = $state<string | null>(null);
  let learningBundleFilterName = $state<string | null>(null);
  let autoplay = $state(false);
  let targetState = $state<string | null>(null);
  let targetSurface = $state<string | null>(null);
  let coverageBundle = $state<string | null>(null);
  let editingModuleId = $state<string | null>(null);
  let editingPackId = $state<string | null>(null);
  let editingPackBasedOn = $state<string | null>(null);

  // Dev flags parsed from ?dev= comma-separated param
  let debugExpanded = $state(false);
  let autoDismissFeedback = $state(false);
  /** Target phase for instant skip-to-phase (?phase=review|playing|declarer). */
  let skipToPhase = $state<"review" | "playing" | "declarer" | null>(null);
  /** Dev-override practice mode from URL param (?practiceMode=). */
  let devPracticeMode = $state<PracticeMode | null>(null);
  /** Dev-override practice role from URL param (?practiceRole=). */
  let devPracticeRole = $state<PracticeRole | null>(null);

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
    get lastPracticedId() {
      return lastPracticedId;
    },

    get devSeed() {
      return devSeed;
    },
    get devDealCount() {
      return devDealCount;
    },

    selectConvention(config: ConventionInfo) {
      selectedConvention = config;
      saveLastConvention(config.id);
      learningConvention = null;
      currentScreen = "game";
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
      editingModuleId = null;
      editingPackId = null;
      editingPackBasedOn = null;
      currentScreen = "conventions";
    },

    navigateToSettings() {
      currentScreen = "settings";
    },

    navigateToCoverage() {
      currentScreen = "coverage";
    },

    navigateToWorkshop() {
      editingModuleId = null;
      editingPackId = null;
      editingPackBasedOn = null;
      currentScreen = "workshop";
    },

    navigateToProfiles() {
      currentScreen = "workshop";
    },

    get editingModuleId() {
      return editingModuleId;
    },

    navigateToConventionEditor(moduleId: string | null) {
      editingModuleId = moduleId;
      currentScreen = "convention-editor";
    },

    get editingPackId() {
      return editingPackId;
    },

    get editingPackBasedOn() {
      return editingPackBasedOn;
    },

    navigateToPackEditor(packId: string | null, basedOn?: string | null) {
      editingPackId = packId;
      editingPackBasedOn = basedOn ?? null;
      currentScreen = "practice-pack-editor";
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

    get userPracticeMode(): PracticeMode | undefined {
      return prefs.drill.practiceMode;
    },

    setUserPracticeMode(mode: PracticeMode) {
      updateDrill({ practiceMode: mode });
    },

    setPracticeMode(mode: PracticeMode | null) {
      devPracticeMode = mode;
    },

    get devPracticeRole() {
      return devPracticeRole;
    },

    get userPracticeRole(): PracticeRole | undefined {
      return prefs.drill.practiceRole;
    },

    setUserPracticeRole(role: PracticeRole) {
      updateDrill({ practiceRole: role });
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

    setBaseSystemId(id: SystemSelectionId) {
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
