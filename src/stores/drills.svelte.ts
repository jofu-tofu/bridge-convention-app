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

import { PracticeMode, PracticeRole } from "../service";
import type { SystemSelectionId } from "../service";
import { AVAILABLE_BASE_SYSTEMS } from "../service";
import { listConventions, listModules } from "../service";
import { canonicalBundleId } from "./bundle-id-migration";
import { loadFromStorage, saveToStorage } from "./local-storage";

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
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
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
  if (typeof r.createdAt !== "string") return false;
  if (typeof r.updatedAt !== "string") return false;
  if (r.lastUsedAt !== null && typeof r.lastUsedAt !== "string") return false;
  return true;
}

// ─── Persistence ────────────────────────────────────────────

function loadDrills(): Drill[] {
  return loadFromStorage(STORAGE_KEY, [] as Drill[], (raw) => {
    const parsed = raw as StoredDrills;
    if (!Array.isArray(parsed?.drills)) return undefined;
    return parsed.drills
      .filter(validateStoredDrill)
      .map((d) => ({
        ...d,
        moduleIds: d.moduleIds.map(canonicalBundleId),
      }));
  });
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

function migrateFromLegacy(defaultSystemId: SystemSelectionId): {
  drills: Drill[];
  skipped: number;
} {
  const migrated: Drill[] = [];
  let skipped = 0;
  const knownModuleIds = loadKnownModuleIds();

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

function loadOrMigrate(defaultSystemId: SystemSelectionId): {
  drills: Drill[];
  migrated: boolean;
  skipped: number;
} {
  try {
    if (localStorage.getItem(STORAGE_KEY) !== null) {
      return { drills: loadDrills(), migrated: false, skipped: 0 };
    }
  } catch {
    return { drills: [], migrated: false, skipped: 0 };
  }

  const { drills, skipped } = migrateFromLegacy(defaultSystemId);
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
}

export interface UpdateDrillParams {
  name?: string;
  moduleIds?: readonly string[];
  practiceMode?: PracticeMode;
  practiceRole?: DrillPracticeRole;
  systemSelectionId?: SystemSelectionId;
}

export interface CreateDrillsStoreArgs {
  defaultSystemId: SystemSelectionId;
}

export function createDrillsStore(args: CreateDrillsStoreArgs) {
  const initial = loadOrMigrate(args.defaultSystemId);
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
      const drill: Drill = {
        id: generateId(),
        name: params.name.trim(),
        moduleIds,
        practiceMode: params.practiceMode,
        practiceRole: params.practiceRole,
        systemSelectionId: params.systemSelectionId,
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
