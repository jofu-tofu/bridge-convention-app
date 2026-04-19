/**
 * Drills store — unified replacement for drill-presets, custom-drills, and
 * practice-packs.
 *
 * A Drill is a saved practice configuration: one or more convention modules
 * plus mode/role/system. Single-convention drills cover the lightweight MRU
 * "preset" surface; multi-convention drills cover what practice packs did.
 *
 * Persists `SystemSelectionId` (TS-only), never a serialized `SystemConfig`.
 * MRU sort: lastUsedAt DESC (nulls last), updatedAt DESC tiebreaker.
 * No soft cap (evidence-map §3 — bimodal usage).
 */

import { OpponentMode, PracticeMode, PracticeRole } from "../service";
import type { PlayProfileId, SystemSelectionId, VulnerabilityDistribution } from "../service";
import { AVAILABLE_BASE_SYSTEMS } from "../service";
import { listConventions, listModules } from "../service";
import { canonicalBundleId } from "./bundle-id-migration";
import { saveToStorage } from "./local-storage";

const VALID_PLAY_PROFILE_IDS: ReadonlySet<string> = new Set([
  "beginner",
  "club-player",
  "expert",
  "world-class",
]);

const STORAGE_KEY = "bridge-app:drills";
const LEGACY_PRESETS_KEY = "bridge-app:drill-presets";
const LEGACY_CUSTOM_DRILLS_KEY = "bridge-app:custom-drills";
const LEGACY_PACKS_KEY = "bridge-app:practice-packs";

export const DRILL_NAME_MAX = 80;

export type DrillPracticeRole = PracticeRole | "auto";

export interface Drill {
  id: `drill:${string}`;
  name: string;
  moduleIds: string[];
  practiceMode: PracticeMode;
  practiceRole: DrillPracticeRole;
  systemSelectionId: SystemSelectionId;
  opponentMode: OpponentMode;
  playProfileId: PlayProfileId;
  vulnerabilityDistribution: VulnerabilityDistribution;
  showEducationalAnnotations: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

/**
 * Snapshot of practice preferences captured at drill-store construction.
 * Used once for healing legacy drills that pre-date the four gameplay
 * tunable fields. After healing, drills carry fully explicit values and
 * the store never reads `appStore.prefs` again.
 */
export interface DrillSeed {
  readonly opponentMode: OpponentMode;
  readonly playProfileId: PlayProfileId;
  readonly vulnerabilityDistribution: VulnerabilityDistribution;
  readonly showEducationalAnnotations: boolean;
}

interface StoredDrills {
  drills: Drill[];
}

// ─── Validators ─────────────────────────────────────────────

function isPracticeMode(v: unknown): v is PracticeMode {
  return v === PracticeMode.DecisionDrill || v === PracticeMode.FullAuction || v === PracticeMode.Learn;
}

function isDrillPracticeRole(v: unknown): v is DrillPracticeRole {
  return (
    v === PracticeRole.Opener ||
    v === PracticeRole.Responder ||
    v === PracticeRole.Both ||
    v === "auto"
  );
}

function isSystemSelectionId(v: unknown): v is SystemSelectionId {
  if (typeof v !== "string" || !v) return false;
  if (v.startsWith("custom:")) return true;
  return AVAILABLE_BASE_SYSTEMS.some((s) => s.id === v);
}

function isOpponentMode(v: unknown): v is OpponentMode {
  return v === OpponentMode.Natural || v === OpponentMode.None;
}

function isPlayProfileId(v: unknown): v is PlayProfileId {
  return typeof v === "string" && VALID_PLAY_PROFILE_IDS.has(v);
}

function isVulnerabilityDistribution(v: unknown): v is VulnerabilityDistribution {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.none === "number" &&
    typeof r.ours === "number" &&
    typeof r.theirs === "number" &&
    typeof r.both === "number" &&
    r.none >= 0 && r.ours >= 0 && r.theirs >= 0 && r.both >= 0 &&
    (r.none + r.ours + r.theirs + r.both) > 0
  );
}

/**
 * Strict validator — used after healing. Records that pass this validator
 * carry every field explicitly; no fallbacks at read time.
 */
function validateStoredDrill(d: unknown): d is Drill {
  if (!d || typeof d !== "object") return false;
  const r = d as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id.startsWith("drill:")) return false;
  if (typeof r.name !== "string" || !r.name.trim()) return false;
  if (!Array.isArray(r.moduleIds) || r.moduleIds.length === 0) return false;
  if (!r.moduleIds.every((m) => typeof m === "string" && m.length > 0)) return false;
  if (!isPracticeMode(r.practiceMode)) return false;
  if (!isDrillPracticeRole(r.practiceRole)) return false;
  if (!isSystemSelectionId(r.systemSelectionId)) return false;
  if (!isOpponentMode(r.opponentMode)) return false;
  if (!isPlayProfileId(r.playProfileId)) return false;
  if (!isVulnerabilityDistribution(r.vulnerabilityDistribution)) return false;
  if (typeof r.showEducationalAnnotations !== "boolean") return false;
  if (typeof r.createdAt !== "string") return false;
  if (typeof r.updatedAt !== "string") return false;
  if (r.lastUsedAt !== null && typeof r.lastUsedAt !== "string") return false;
  return true;
}

/**
 * Pre-healing validator: a record is "old-schema valid" when every field
 * required by the previous schema is present and well-typed. Records that
 * pass this but fail strict validation are eligible for one-time healing.
 */
function isLegacyDrillRecord(d: unknown): boolean {
  if (!d || typeof d !== "object") return false;
  const r = d as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id.startsWith("drill:")) return false;
  if (typeof r.name !== "string" || !r.name.trim()) return false;
  if (!Array.isArray(r.moduleIds) || r.moduleIds.length === 0) return false;
  if (!r.moduleIds.every((m) => typeof m === "string" && m.length > 0)) return false;
  if (!isPracticeMode(r.practiceMode)) return false;
  if (!isDrillPracticeRole(r.practiceRole)) return false;
  if (!isSystemSelectionId(r.systemSelectionId)) return false;
  if (typeof r.createdAt !== "string") return false;
  if (typeof r.updatedAt !== "string") return false;
  if (r.lastUsedAt !== null && typeof r.lastUsedAt !== "string") return false;
  return true;
}

// ─── Persistence ────────────────────────────────────────────

interface LoadResult {
  drills: Drill[];
  healed: number;
  skipped: number;
}

/**
 * Read raw records from `localStorage`, then either validate strictly,
 * heal legacy-schema records by filling the four new fields from the
 * provided seed, or skip malformed records. Healed records are written
 * back at the end of the pass.
 */
function loadDrillsWithHealing(seed: DrillSeed): LoadResult {
  const drills: Drill[] = [];
  let healed = 0;
  let skipped = 0;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { drills, healed: 0, skipped: 0 };
  }
  if (raw === null) return { drills, healed: 0, skipped: 0 };

  let parsed: StoredDrills | undefined;
  try {
    parsed = JSON.parse(raw) as StoredDrills;
  } catch {
    return { drills, healed: 0, skipped: 0 };
  }
  if (!parsed || !Array.isArray(parsed.drills)) return { drills, healed: 0, skipped: 0 };

  for (const entry of parsed.drills) {
    if (validateStoredDrill(entry)) {
      drills.push({ ...entry, moduleIds: entry.moduleIds.map(canonicalBundleId) });
      continue;
    }
    if (isLegacyDrillRecord(entry)) {
      const r = entry as Record<string, unknown>;
      const opponentMode = isOpponentMode(r.opponentMode) ? r.opponentMode : seed.opponentMode;
      const playProfileId = isPlayProfileId(r.playProfileId) ? r.playProfileId : seed.playProfileId;
      const vulnerabilityDistribution = isVulnerabilityDistribution(r.vulnerabilityDistribution)
        ? r.vulnerabilityDistribution
        : seed.vulnerabilityDistribution;
      const showEducationalAnnotations = typeof r.showEducationalAnnotations === "boolean"
        ? r.showEducationalAnnotations
        : seed.showEducationalAnnotations;
      const healedDrill: Drill = {
        id: r.id as `drill:${string}`,
        name: r.name as string,
        moduleIds: (r.moduleIds as string[]).map(canonicalBundleId),
        practiceMode: r.practiceMode as PracticeMode,
        practiceRole: r.practiceRole as DrillPracticeRole,
        systemSelectionId: r.systemSelectionId as SystemSelectionId,
        opponentMode,
        playProfileId,
        vulnerabilityDistribution,
        showEducationalAnnotations,
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string,
        lastUsedAt: (r.lastUsedAt ?? null) as string | null,
      };
      drills.push(healedDrill);
      healed++;
      continue;
    }
    skipped++;
    warnMigration("[drills] skipping malformed drill record", entry);
  }

  if (healed > 0) {
    try {
      saveToStorage(STORAGE_KEY, { drills } satisfies StoredDrills);
    } catch {
      // ignore — heal-on-next-load is fine
    }
  }
  return { drills, healed, skipped };
}

function persist(drills: Drill[]): void {
  saveToStorage(STORAGE_KEY, { drills } satisfies StoredDrills);
}

// ─── Helpers ────────────────────────────────────────────────

function generateId(): `drill:${string}` {
  return `drill:${crypto.randomUUID().slice(0, 8)}`;
}

function sortMru(list: readonly Drill[]): Drill[] {
  return [...list].sort((a, b) => {
    if (a.lastUsedAt && b.lastUsedAt) {
      const byLast = b.lastUsedAt.localeCompare(a.lastUsedAt);
      if (byLast !== 0) return byLast;
    } else if (a.lastUsedAt) {
      return -1;
    } else if (b.lastUsedAt) {
      return 1;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function loadKnownModuleIds(): ReadonlySet<string> | null {
  try {
    return new Set([
      ...listConventions().map((convention) => convention.id),
      ...listModules().map((module) => module.moduleId),
    ]);
  } catch {
    return null;
  }
}

function isKnownModuleId(id: string, knownModuleIds: ReadonlySet<string> | null): boolean {
  if (id.startsWith("user:")) return true;
  if (knownModuleIds === null) return true;
  return knownModuleIds.has(id);
}

function warnMigration(message: string, value: unknown): void {
  // eslint-disable-next-line no-console
  console.warn(message, value);
}

// ─── Legacy migration ──────────────────────────────────────

interface LegacyPreset {
  id: string;
  name: string;
  conventionId: string;
  practiceMode: PracticeMode;
  practiceRole: PracticeRole;
  systemSelectionId: SystemSelectionId;
  createdAt: string;
  lastUsedAt: string | null;
}

interface LegacyCustomDrill {
  id: string;
  name: string;
  conventionId: string;
  practiceRole: PracticeRole;
  systemSelectionId: SystemSelectionId;
  createdAt: string;
  updatedAt: string;
}

interface LegacyPack {
  id: string;
  name: string;
  conventionIds: unknown;
  createdAt: string;
  updatedAt: string;
}

function isLegacyPreset(p: unknown): p is LegacyPreset {
  if (!p || typeof p !== "object") return false;
  const r = p as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    r.id.startsWith("drill:") &&
    typeof r.name === "string" &&
    !!r.name.trim() &&
    typeof r.conventionId === "string" &&
    !!r.conventionId &&
    isPracticeMode(r.practiceMode) &&
    (r.practiceRole === PracticeRole.Opener ||
      r.practiceRole === PracticeRole.Responder ||
      r.practiceRole === PracticeRole.Both) &&
    isSystemSelectionId(r.systemSelectionId) &&
    typeof r.createdAt === "string" &&
    (r.lastUsedAt === null || typeof r.lastUsedAt === "string")
  );
}

function isLegacyCustomDrill(d: unknown): d is LegacyCustomDrill {
  if (!d || typeof d !== "object") return false;
  const r = d as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    r.id.startsWith("custom-drill:") &&
    typeof r.name === "string" &&
    !!r.name.trim() &&
    typeof r.conventionId === "string" &&
    !!r.conventionId &&
    (r.practiceRole === PracticeRole.Opener ||
      r.practiceRole === PracticeRole.Responder ||
      r.practiceRole === PracticeRole.Both) &&
    isSystemSelectionId(r.systemSelectionId) &&
    typeof r.createdAt === "string" &&
    typeof r.updatedAt === "string"
  );
}

function isLegacyPack(p: unknown): p is LegacyPack {
  if (!p || typeof p !== "object") return false;
  const r = p as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    r.id.startsWith("practice-pack:") &&
    typeof r.name === "string" &&
    !!r.name &&
    Array.isArray(r.conventionIds) &&
    typeof r.createdAt === "string" &&
    typeof r.updatedAt === "string"
  );
}

function migrateFromLegacy(
  defaultSystemId: SystemSelectionId,
  seed: DrillSeed,
): {
  drills: Drill[];
  skipped: number;
} {
  const migrated: Drill[] = [];
  let skipped = 0;
  const knownModuleIds = loadKnownModuleIds();
  const tunableDefaults = {
    opponentMode: seed.opponentMode,
    playProfileId: seed.playProfileId,
    vulnerabilityDistribution: seed.vulnerabilityDistribution,
    showEducationalAnnotations: seed.showEducationalAnnotations,
  };

  // Presets
  try {
    const raw = localStorage.getItem(LEGACY_PRESETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { presets?: unknown };
      const list = Array.isArray(parsed?.presets) ? parsed.presets : [];
      for (const entry of list) {
        if (!isLegacyPreset(entry)) {
          skipped++;
          warnMigration("[drills] skipping invalid legacy preset", entry);
          continue;
        }
        const moduleId = canonicalBundleId(entry.conventionId);
        if (!isKnownModuleId(moduleId, knownModuleIds)) {
          skipped++;
          warnMigration("[drills] skipping legacy preset with unknown module", entry);
          continue;
        }
        const idSuffix = entry.id.replace(/^drill:/, "");
        migrated.push({
          id: `drill:preset-${idSuffix}`,
          name: entry.name.trim(),
          moduleIds: [moduleId],
          practiceMode: entry.practiceMode,
          practiceRole: entry.practiceRole,
          systemSelectionId: entry.systemSelectionId,
          ...tunableDefaults,
          createdAt: entry.createdAt,
          updatedAt: entry.createdAt,
          lastUsedAt: entry.lastUsedAt ?? null,
        });
      }
    }
  } catch (err) {
    warnMigration("[drills] failed to read legacy presets", err);
  }

  // Custom drills
  try {
    const raw = localStorage.getItem(LEGACY_CUSTOM_DRILLS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { drills?: unknown };
      const list = Array.isArray(parsed?.drills) ? parsed.drills : [];
      for (const entry of list) {
        if (!isLegacyCustomDrill(entry)) {
          skipped++;
          warnMigration("[drills] skipping invalid legacy custom drill", entry);
          continue;
        }
        const moduleId = canonicalBundleId(entry.conventionId);
        if (!isKnownModuleId(moduleId, knownModuleIds)) {
          skipped++;
          warnMigration("[drills] skipping legacy custom drill with unknown module", entry);
          continue;
        }
        const idSuffix = entry.id.replace(/^custom-drill:/, "");
        migrated.push({
          id: `drill:custom-${idSuffix}`,
          name: entry.name.trim(),
          moduleIds: [moduleId],
          practiceMode: PracticeMode.DecisionDrill,
          practiceRole: entry.practiceRole,
          systemSelectionId: entry.systemSelectionId,
          ...tunableDefaults,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          lastUsedAt: null,
        });
      }
    }
  } catch (err) {
    warnMigration("[drills] failed to read legacy custom drills", err);
  }

  // Practice packs
  try {
    const raw = localStorage.getItem(LEGACY_PACKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { packs?: unknown };
      const list = Array.isArray(parsed?.packs) ? parsed.packs : [];
      for (const entry of list) {
        if (!isLegacyPack(entry)) {
          skipped++;
          warnMigration("[drills] skipping invalid legacy pack", entry);
          continue;
        }
        const moduleIds = (entry.conventionIds as unknown[])
          .filter((m): m is string => typeof m === "string" && m.length > 0)
          .map(canonicalBundleId)
          .filter((moduleId) => isKnownModuleId(moduleId, knownModuleIds));
        if (moduleIds.length === 0) {
          skipped++;
          warnMigration("[drills] skipping legacy pack with no usable modules", entry);
          continue;
        }
        const idSuffix = entry.id.replace(/^practice-pack:/, "");
        migrated.push({
          id: `drill:pack-${idSuffix}`,
          name: entry.name.trim() || "Untitled pack",
          moduleIds,
          practiceMode: PracticeMode.DecisionDrill,
          practiceRole: "auto",
          systemSelectionId: defaultSystemId,
          ...tunableDefaults,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          lastUsedAt: null,
        });
      }
    }
  } catch (err) {
    warnMigration("[drills] failed to read legacy packs", err);
  }

  return { drills: migrated, skipped };
}

function loadOrMigrate(defaultSystemId: SystemSelectionId, seed: DrillSeed): {
  drills: Drill[];
  migrated: boolean;
  skipped: number;
} {
  try {
    if (localStorage.getItem(STORAGE_KEY) !== null) {
      const result = loadDrillsWithHealing(seed);
      return { drills: result.drills, migrated: false, skipped: result.skipped };
    }
  } catch {
    return { drills: [], migrated: false, skipped: 0 };
  }

  const { drills, skipped } = migrateFromLegacy(defaultSystemId, seed);
  if (drills.length > 0 || skipped > 0) {
    persist(drills);
  }
  return { drills, migrated: true, skipped };
}

// ─── Public API ────────────────────────────────────────────

export interface CreateDrillParams {
  name: string;
  moduleIds: readonly string[];
  practiceMode: PracticeMode;
  practiceRole: DrillPracticeRole;
  systemSelectionId: SystemSelectionId;
  opponentMode: OpponentMode;
  playProfileId: PlayProfileId;
  vulnerabilityDistribution: VulnerabilityDistribution;
  showEducationalAnnotations: boolean;
}

export interface UpdateDrillParams {
  name?: string;
  moduleIds?: readonly string[];
  practiceMode?: PracticeMode;
  practiceRole?: DrillPracticeRole;
  systemSelectionId?: SystemSelectionId;
  opponentMode?: OpponentMode;
  playProfileId?: PlayProfileId;
  vulnerabilityDistribution?: VulnerabilityDistribution;
  showEducationalAnnotations?: boolean;
}

export interface CreateDrillsStoreArgs {
  defaultSystemId: SystemSelectionId;
  /**
   * One-time snapshot of practice preferences used to heal legacy drill
   * records that pre-date the four gameplay tunable fields. The store
   * never reads `appStore.prefs` after construction — drills carry
   * fully explicit values from this point on.
   */
  seedFromPrefs: DrillSeed;
}

export function createDrillsStore(args: CreateDrillsStoreArgs) {
  const initial = loadOrMigrate(args.defaultSystemId, args.seedFromPrefs);
  let drills = $state<Drill[]>(sortMru(initial.drills));

  function save(): void {
    persist(drills);
  }

  return {
    get drills(): readonly Drill[] {
      return drills;
    },

    get migrationSkipped(): number {
      return initial.skipped;
    },

    getById(id: string): Drill | undefined {
      return drills.find((d) => d.id === id);
    },

    list(): readonly Drill[] {
      return drills;
    },

    validateName(name: string): string | null {
      const trimmed = name.trim();
      if (!trimmed) return "Name is required";
      if (trimmed.length > DRILL_NAME_MAX) {
        return `Name must be ${DRILL_NAME_MAX} characters or fewer`;
      }
      return null;
    },

    create(params: CreateDrillParams): Drill {
      const now = new Date().toISOString();
      const moduleIds = params.moduleIds.map(canonicalBundleId).filter((m) => m.length > 0);
      if (moduleIds.length === 0) {
        throw new Error("Drill requires at least one module");
      }
      if (!isVulnerabilityDistribution(params.vulnerabilityDistribution)) {
        throw new Error("Drill vulnerability distribution must have at least one non-zero weight");
      }
      const drill: Drill = {
        id: generateId(),
        name: params.name.trim(),
        moduleIds,
        practiceMode: params.practiceMode,
        practiceRole: params.practiceRole,
        systemSelectionId: params.systemSelectionId,
        opponentMode: params.opponentMode,
        playProfileId: params.playProfileId,
        vulnerabilityDistribution: params.vulnerabilityDistribution,
        showEducationalAnnotations: params.showEducationalAnnotations,
        createdAt: now,
        updatedAt: now,
        lastUsedAt: null,
      };
      drills = sortMru([...drills, drill]);
      save();
      return drill;
    },

    update(id: string, patch: UpdateDrillParams): void {
      const now = new Date().toISOString();
      if (
        patch.vulnerabilityDistribution !== undefined &&
        !isVulnerabilityDistribution(patch.vulnerabilityDistribution)
      ) {
        throw new Error("Drill vulnerability distribution must have at least one non-zero weight");
      }
      drills = sortMru(
        drills.map((d) => {
          if (d.id !== id) return d;
          return {
            ...d,
            ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
            ...(patch.moduleIds !== undefined
              ? { moduleIds: patch.moduleIds.map(canonicalBundleId).filter((m) => m.length > 0) }
              : {}),
            ...(patch.practiceMode !== undefined ? { practiceMode: patch.practiceMode } : {}),
            ...(patch.practiceRole !== undefined ? { practiceRole: patch.practiceRole } : {}),
            ...(patch.systemSelectionId !== undefined
              ? { systemSelectionId: patch.systemSelectionId }
              : {}),
            ...(patch.opponentMode !== undefined ? { opponentMode: patch.opponentMode } : {}),
            ...(patch.playProfileId !== undefined ? { playProfileId: patch.playProfileId } : {}),
            ...(patch.vulnerabilityDistribution !== undefined
              ? { vulnerabilityDistribution: patch.vulnerabilityDistribution }
              : {}),
            ...(patch.showEducationalAnnotations !== undefined
              ? { showEducationalAnnotations: patch.showEducationalAnnotations }
              : {}),
            updatedAt: now,
          };
        }),
      );
      save();
    },

    rename(id: string, name: string): void {
      this.update(id, { name });
    },

    delete(id: string): void {
      drills = drills.filter((d) => d.id !== id);
      save();
    },

    markLaunched(id: string): void {
      const now = new Date().toISOString();
      drills = sortMru(
        drills.map((d) => (d.id === id ? { ...d, lastUsedAt: now } : d)),
      );
      save();
    },
  };
}

export type DrillsStore = ReturnType<typeof createDrillsStore>;
