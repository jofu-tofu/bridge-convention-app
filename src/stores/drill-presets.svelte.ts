/**
 * Drill presets store — CRUD for named drill configurations.
 *
 * A drill preset is a saved tuple `(conventionId, practiceMode, practiceRole,
 * systemSelectionId)` plus a user-given name. Sorted MRU (lastUsedAt DESC,
 * nulls last, createdAt tiebreaker). Soft cap of 20.
 *
 * Persists `SystemSelectionId` (TS-only), never a serialized `SystemConfig`.
 */

import { PracticeMode, PracticeRole } from "../service";
import type { SystemSelectionId } from "../service";
import { canonicalBundleId } from "./bundle-id-migration";
import { loadFromStorage, saveToStorage } from "./local-storage";

const STORAGE_KEY = "bridge-app:drill-presets";
export const DRILL_PRESET_SOFT_CAP = 20;
export const DRILL_PRESET_NAME_MAX = 60;

export interface DrillPreset {
  id: `drill:${string}`;
  name: string;
  conventionId: string;
  practiceMode: PracticeMode;
  practiceRole: PracticeRole;
  systemSelectionId: SystemSelectionId;
  createdAt: string;
  lastUsedAt: string | null;
}

interface StoredPresets {
  presets: DrillPreset[];
}

function isPracticeMode(v: unknown): v is PracticeMode {
  return v === PracticeMode.DecisionDrill || v === PracticeMode.FullAuction || v === PracticeMode.Learn;
}

function isPracticeRole(v: unknown): v is PracticeRole {
  return v === PracticeRole.Opener || v === PracticeRole.Responder || v === PracticeRole.Both;
}

function isSystemSelectionId(v: unknown): v is SystemSelectionId {
  return typeof v === "string" && v.length > 0;
}

function validateStoredPreset(p: unknown): p is DrillPreset {
  if (!p || typeof p !== "object") return false;
  const r = p as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id.startsWith("drill:")) return false;
  if (typeof r.name !== "string" || !r.name.trim()) return false;
  if (typeof r.conventionId !== "string" || !r.conventionId) return false;
  if (!isPracticeMode(r.practiceMode)) return false;
  if (!isPracticeRole(r.practiceRole)) return false;
  if (!isSystemSelectionId(r.systemSelectionId)) return false;
  if (typeof r.createdAt !== "string") return false;
  if (r.lastUsedAt !== null && typeof r.lastUsedAt !== "string") return false;
  return true;
}

function loadPresets(): DrillPreset[] {
  return loadFromStorage(STORAGE_KEY, [] as DrillPreset[], (raw) => {
    const parsed = raw as StoredPresets;
    if (!Array.isArray(parsed?.presets)) return undefined;
    return parsed.presets
      .filter(validateStoredPreset)
      .map((preset) => ({ ...preset, conventionId: canonicalBundleId(preset.conventionId) }));
  });
}

function savePresets(presets: DrillPreset[]): void {
  const data: StoredPresets = { presets };
  saveToStorage(STORAGE_KEY, data);
}

function generateId(): `drill:${string}` {
  return `drill:${crypto.randomUUID().slice(0, 8)}`;
}

function sortMru(list: DrillPreset[]): DrillPreset[] {
  return [...list].sort((a, b) => {
    if (a.lastUsedAt && b.lastUsedAt) return b.lastUsedAt.localeCompare(a.lastUsedAt);
    if (a.lastUsedAt) return -1;
    if (b.lastUsedAt) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export interface CreatePresetParams {
  name: string;
  conventionId: string;
  practiceMode: PracticeMode;
  practiceRole: PracticeRole;
  systemSelectionId: SystemSelectionId;
}

export interface UpdatePresetParams {
  name?: string;
  practiceMode?: PracticeMode;
  practiceRole?: PracticeRole;
  systemSelectionId?: SystemSelectionId;
}

export function createDrillPresetsStore() {
  let presets = $state<DrillPreset[]>(sortMru(loadPresets()));

  function persist(): void {
    savePresets(presets);
  }

  return {
    get presets(): readonly DrillPreset[] {
      return presets;
    },

    getPreset(id: string): DrillPreset | undefined {
      return presets.find((p) => p.id === id);
    },

    /** Returns null if valid, else a human-readable error. */
    validateName(name: string): string | null {
      const trimmed = name.trim();
      if (!trimmed) return "Name is required";
      if (trimmed.length > DRILL_PRESET_NAME_MAX) return `Name must be ${DRILL_PRESET_NAME_MAX} characters or fewer`;
      return null;
    },

    get atSoftCap(): boolean {
      return presets.length >= DRILL_PRESET_SOFT_CAP;
    },

    create(params: CreatePresetParams): DrillPreset {
      if (presets.length >= DRILL_PRESET_SOFT_CAP) {
        throw new Error(`Cannot create more than ${DRILL_PRESET_SOFT_CAP} drill presets`);
      }
      const now = new Date().toISOString();
      const preset: DrillPreset = {
        id: generateId(),
        name: params.name.trim(),
        conventionId: canonicalBundleId(params.conventionId),
        practiceMode: params.practiceMode,
        practiceRole: params.practiceRole,
        systemSelectionId: params.systemSelectionId,
        createdAt: now,
        lastUsedAt: null,
      };
      presets = sortMru([...presets, preset]);
      persist();
      return preset;
    },

    update(id: string, patch: UpdatePresetParams): void {
      presets = sortMru(
        presets.map((p) => {
          if (p.id !== id) return p;
          return {
            ...p,
            ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
            ...(patch.practiceMode !== undefined ? { practiceMode: patch.practiceMode } : {}),
            ...(patch.practiceRole !== undefined ? { practiceRole: patch.practiceRole } : {}),
            ...(patch.systemSelectionId !== undefined ? { systemSelectionId: patch.systemSelectionId } : {}),
          };
        }),
      );
      persist();
    },

    delete(id: string): void {
      presets = presets.filter((p) => p.id !== id);
      persist();
    },

    markLaunched(id: string): void {
      presets = sortMru(
        presets.map((p) => (p.id === id ? { ...p, lastUsedAt: new Date().toISOString() } : p)),
      );
      persist();
    },
  };
}

export type DrillPresetsStore = ReturnType<typeof createDrillPresetsStore>;
