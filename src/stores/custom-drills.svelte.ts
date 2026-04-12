/**
 * Custom drills store — CRUD for user-created drill configurations.
 *
 * Phase 1 scope: name + conventionId + practiceRole + systemSelectionId.
 * Richer config (auction prefix, hand constraints, opponent style) will be
 * added here as configurable fields expand. Distinct from `drill-presets`,
 * which remains the lightweight MRU quick-chip surface.
 *
 * Persists `SystemSelectionId` (TS-only), never a serialized `SystemConfig`.
 */

import { PracticeRole } from "../service";
import type { SystemSelectionId } from "../service";
import { loadFromStorage, saveToStorage } from "./local-storage";

const STORAGE_KEY = "bridge-app:custom-drills";
export const CUSTOM_DRILL_NAME_MAX = 80;

export interface CustomDrill {
  id: `custom-drill:${string}`;
  name: string;
  conventionId: string;
  practiceRole: PracticeRole;
  systemSelectionId: SystemSelectionId;
  createdAt: string;
  updatedAt: string;
}

interface StoredDrills {
  drills: CustomDrill[];
}

function isPracticeRole(v: unknown): v is PracticeRole {
  return v === PracticeRole.Opener || v === PracticeRole.Responder || v === PracticeRole.Both;
}

function isSystemSelectionId(v: unknown): v is SystemSelectionId {
  return typeof v === "string" && v.length > 0;
}

function validateStoredDrill(d: unknown): d is CustomDrill {
  if (!d || typeof d !== "object") return false;
  const r = d as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id.startsWith("custom-drill:")) return false;
  if (typeof r.name !== "string" || !r.name.trim()) return false;
  if (typeof r.conventionId !== "string" || !r.conventionId) return false;
  if (!isPracticeRole(r.practiceRole)) return false;
  if (!isSystemSelectionId(r.systemSelectionId)) return false;
  if (typeof r.createdAt !== "string") return false;
  if (typeof r.updatedAt !== "string") return false;
  return true;
}

function loadDrills(): CustomDrill[] {
  return loadFromStorage(STORAGE_KEY, [] as CustomDrill[], (raw) => {
    const parsed = raw as StoredDrills;
    if (!Array.isArray(parsed?.drills)) return undefined;
    return parsed.drills.filter(validateStoredDrill);
  });
}

function saveDrills(drills: CustomDrill[]): void {
  const data: StoredDrills = { drills };
  saveToStorage(STORAGE_KEY, data);
}

function generateId(): `custom-drill:${string}` {
  return `custom-drill:${crypto.randomUUID().slice(0, 8)}`;
}

function sortByUpdated(list: CustomDrill[]): CustomDrill[] {
  return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export interface CreateCustomDrillParams {
  name: string;
  conventionId: string;
  practiceRole: PracticeRole;
  systemSelectionId: SystemSelectionId;
}

export interface UpdateCustomDrillParams {
  name?: string;
  conventionId?: string;
  practiceRole?: PracticeRole;
  systemSelectionId?: SystemSelectionId;
}

export function createCustomDrillsStore() {
  let drills = $state<CustomDrill[]>(sortByUpdated(loadDrills()));

  function persist(): void {
    saveDrills(drills);
  }

  return {
    get drills(): readonly CustomDrill[] {
      return drills;
    },

    getDrill(id: string): CustomDrill | undefined {
      return drills.find((d) => d.id === id);
    },

    /** Returns null if valid, else a human-readable error. */
    validateName(name: string): string | null {
      const trimmed = name.trim();
      if (!trimmed) return "Name is required";
      if (trimmed.length > CUSTOM_DRILL_NAME_MAX) return `Name must be ${CUSTOM_DRILL_NAME_MAX} characters or fewer`;
      return null;
    },

    create(params: CreateCustomDrillParams): CustomDrill {
      const now = new Date().toISOString();
      const drill: CustomDrill = {
        id: generateId(),
        name: params.name.trim(),
        conventionId: params.conventionId,
        practiceRole: params.practiceRole,
        systemSelectionId: params.systemSelectionId,
        createdAt: now,
        updatedAt: now,
      };
      drills = sortByUpdated([...drills, drill]);
      persist();
      return drill;
    },

    update(id: string, patch: UpdateCustomDrillParams): void {
      const now = new Date().toISOString();
      drills = sortByUpdated(
        drills.map((d) => {
          if (d.id !== id) return d;
          return {
            ...d,
            ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
            ...(patch.conventionId !== undefined ? { conventionId: patch.conventionId } : {}),
            ...(patch.practiceRole !== undefined ? { practiceRole: patch.practiceRole } : {}),
            ...(patch.systemSelectionId !== undefined ? { systemSelectionId: patch.systemSelectionId } : {}),
            updatedAt: now,
          };
        }),
      );
      persist();
    },

    delete(id: string): void {
      drills = drills.filter((d) => d.id !== id);
      persist();
    },
  };
}

export type CustomDrillsStore = ReturnType<typeof createCustomDrillsStore>;
