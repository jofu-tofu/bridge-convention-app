import type { ConventionInfo, SystemSelectionId, VulnerabilityDistribution, DrillSettings, PlayProfileId, PracticePreferences, DisplayPreferences, PracticeMode, PracticeRole } from "../service";
import { OpponentMode, DEFAULT_DRILL_TUNING, DEFAULT_DRILL_SETTINGS, AVAILABLE_BASE_SYSTEMS, DEFAULT_PRACTICE_PREFERENCES, DEFAULT_DISPLAY_PREFERENCES } from "../service";
import { canonicalBundleId } from "./bundle-id-migration";
import { loadFromStorage, saveToStorage } from "./local-storage";
import type { DrillLaunchConfig } from "./types";

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
  const VALID_PRACTICE_ROLES = new Set<string>(["auto", "responder", "opener", "both"]);
  const practiceRole = drill?.practiceRole && VALID_PRACTICE_ROLES.has(drill.practiceRole)
    ? drill.practiceRole
    : DEFAULT_DRILL_SETTINGS.practiceRole;

  return {
    baseSystemId,
    drill: {
      opponentMode,
      practiceRole,
      ...(playProfileId ? { playProfileId } : {}),
      ...(practiceMode ? { practiceMode } : {}),
      tuning: {
        ...DEFAULT_DRILL_TUNING,
        ...tuningRaw,
        vulnerabilityDistribution: validVd ? vd : DEFAULT_DRILL_TUNING.vulnerabilityDistribution,
      },
    },
    display: mergeDisplay(partial.display as Partial<DisplayPreferences> | undefined),
  };
}

const VALID_CARD_SIZES = new Set<DisplayPreferences["cardSize"]>(["small", "medium", "large"]);

function mergeDisplay(partial: Partial<DisplayPreferences> | undefined): DisplayPreferences {
  const merged = { ...DEFAULT_DISPLAY_PREFERENCES, ...(partial ?? {}) };
  if (!VALID_CARD_SIZES.has(merged.cardSize)) {
    return { ...merged, cardSize: DEFAULT_DISPLAY_PREFERENCES.cardSize };
  }
  return merged;
}

function savePreferences(prefs: PracticePreferences) {
  saveToStorage(SETTINGS_KEY, prefs);
}

// ─── Store ──────────────────────────────────────────────────

export function createAppStore() {
  let selectedConvention = $state<ConventionInfo | null>(null);
  let lastPracticedId = $state<string | null>(loadLastConvention());

  function loadLastConvention(): string | null {
    try {
      const id = localStorage.getItem(LAST_CONVENTION_KEY);
      return id ? canonicalBundleId(id) : null;
    } catch { return null; }
  }

  function saveLastConvention(id: string) {
    const canonicalId = canonicalBundleId(id);
    lastPracticedId = canonicalId;
    try { localStorage.setItem(LAST_CONVENTION_KEY, canonicalId); } catch { /* ignore */ }
  }
  let devSeed = $state<number | null>(null);
  let devDealCount = $state(0);
  let debugPanelOpen = $state(false);
  let autoplay = $state(false);
  let targetState = $state<string | null>(null);
  let targetSurface = $state<string | null>(null);
  let coverageBundle = $state<string | null>(null);
  let editingModuleId = $state<string | null>(null);
  let editingModuleIsNew = $state(false);

  // Dev flags parsed from ?dev= comma-separated param
  let debugExpanded = $state(false);
  let autoDismissFeedback = $state(false);
  /** Target phase for instant skip-to-phase (?phase=review|playing|declarer). */
  let skipToPhase = $state<"review" | "playing" | "declarer" | null>(null);
  /** Dev-override practice mode from URL param (?practiceMode=). */
  let devPracticeMode = $state<PracticeMode | null>(null);
  /** Dev-override practice role from URL param (?practiceRole=). */
  let devPracticeRole = $state<PracticeRole | null>(null);
  let activeLaunch = $state<DrillLaunchConfig | null>(null);

  // All persisted practice preferences — single blob
  let prefs = $state<PracticePreferences>(loadPreferences());

  function setSessionPracticeMode(mode: PracticeMode | undefined) {
    prefs = { ...prefs, drill: { ...prefs.drill, ...(mode ? { practiceMode: mode } : { practiceMode: undefined }) } };
  }

  function setSessionPracticeRole(role: PracticeRole | "auto") {
    prefs = { ...prefs, drill: { ...prefs.drill, practiceRole: role } };
  }

  function setSessionBaseSystemId(id: SystemSelectionId) {
    prefs = { ...prefs, baseSystemId: id };
  }

  function setSessionOpponentMode(mode: OpponentMode) {
    prefs = { ...prefs, drill: { ...prefs.drill, opponentMode: mode } };
  }

  function setSessionPlayProfileId(id: PlayProfileId) {
    prefs = { ...prefs, drill: { ...prefs.drill, playProfileId: id } };
  }

  function setSessionVulnerabilityDistribution(dist: VulnerabilityDistribution) {
    prefs = { ...prefs, drill: { ...prefs.drill, tuning: { ...prefs.drill.tuning, vulnerabilityDistribution: dist } } };
  }

  function setSessionShowEducationalAnnotations(show: boolean) {
    prefs = { ...prefs, display: { ...prefs.display, showEducationalAnnotations: show } };
  }

  function updateDrill(patch: Partial<DrillSettings>) {
    prefs = { ...prefs, drill: { ...prefs.drill, ...patch } };
    savePreferences(prefs);
  }

  function updateDisplay(patch: Partial<DisplayPreferences>) {
    prefs = { ...prefs, display: { ...prefs.display, ...patch } };
    savePreferences(prefs);
  }

  return {
    get selectedConvention() {
      return selectedConvention;
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

    /** Set selected convention and record it as last practiced. Does NOT navigate. */
    selectConvention(config: ConventionInfo) {
      selectedConvention = config;
      saveLastConvention(config.id);
    },

    /** Clear all ephemeral state (selection, editing). Does NOT navigate. */
    clearSelection() {
      selectedConvention = null;
      editingModuleId = null;
    },

    /** Clear workshop editing state. Does NOT navigate. */
    clearWorkshopState() {
      editingModuleId = null;
      editingModuleIsNew = false;
    },

    get editingModuleId() {
      return editingModuleId;
    },

    get editingModuleIsNew() {
      return editingModuleIsNew;
    },

    /** Set convention editor state. Does NOT navigate. */
    setEditingModule(moduleId: string | null, isNew = false) {
      editingModuleId = moduleId;
      editingModuleIsNew = isNew;
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
      setSessionPracticeMode(mode);
      savePreferences(prefs);
    },

    setPracticeMode(mode: PracticeMode | null) {
      devPracticeMode = mode;
    },

    get devPracticeRole() {
      return devPracticeRole;
    },

    get practiceRole(): PracticeRole | "auto" {
      return prefs.drill.practiceRole;
    },

    setPracticeRole(role: PracticeRole | "auto") {
      setSessionPracticeRole(role);
      savePreferences(prefs);
    },

    get userPracticeRole(): PracticeRole | undefined {
      return prefs.drill.practiceRole === "auto" ? undefined : prefs.drill.practiceRole;
    },

    setUserPracticeRole(role: PracticeRole) {
      setSessionPracticeRole(role);
      savePreferences(prefs);
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
      setSessionBaseSystemId(id);
      savePreferences(prefs);
    },

    get activeLaunch() {
      return activeLaunch;
    },

    applyDrillSession(config: DrillLaunchConfig, conventions: readonly ConventionInfo[]) {
      const firstModule = conventions.find((convention) => convention.id === config.moduleIds[0]);
      if (!firstModule) {
        throw new Error(`Unknown module: ${config.moduleIds[0]}`);
      }

      const resolvedRole = config.practiceRole === "auto"
        ? firstModule.defaultRole
        : config.practiceRole;

      setSessionPracticeMode(config.practiceMode);
      setSessionPracticeRole(resolvedRole);
      setSessionBaseSystemId(config.systemSelectionId);
      setSessionOpponentMode(config.opponentMode);
      setSessionPlayProfileId(config.playProfileId);
      setSessionVulnerabilityDistribution(config.vulnerabilityDistribution);
      setSessionShowEducationalAnnotations(config.showEducationalAnnotations);
      activeLaunch = config;
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

    get displaySettings() {
      return prefs.display;
    },

    setCardSize(value: DisplayPreferences["cardSize"]) {
      updateDisplay({ cardSize: value });
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
