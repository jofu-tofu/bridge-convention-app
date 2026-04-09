/**
 * Custom systems store — CRUD, localStorage persistence, and system resolution.
 *
 * `resolveSystemForSession()` is the single authoritative source for mapping
 * any `SystemSelectionId` to the full `{systemConfig, baseModuleIds}` needed
 * for a session. All session-creating callers MUST use this.
 */

import type { SystemSelectionId, CustomSystem, SystemConfig, BaseSystemId, PointFormula } from "../service";
import { getSystemConfig, AVAILABLE_BASE_SYSTEMS, DEFAULT_BASE_MODULE_IDS, normalizePointFormula } from "../service";
import { listModules } from "../service/service-helpers";
import { loadFromStorage, saveToStorage } from "./local-storage";

// ── Constants ──────────────────────────────────────────────────────

const STORAGE_KEY = "bridge-app:custom-systems";

// ── localStorage persistence ───────────────────────────────────────

interface StoredSystems {
  systems: CustomSystem[];
}

function loadSystems(): CustomSystem[] {
  return loadFromStorage(STORAGE_KEY, [] as CustomSystem[], (raw) => {
    const parsed = raw as StoredSystems;
    if (!Array.isArray(parsed?.systems)) return undefined;
    return parsed.systems.filter(validateStoredSystem).map(healSystem);
  });
}

function saveSystems(systems: CustomSystem[]): void {
  const data: StoredSystems = { systems };
  saveToStorage(STORAGE_KEY, data);
}

/** Shallow validation of a stored system entry. */
function validateStoredSystem(system: unknown): system is CustomSystem {
  if (!system || typeof system !== "object") return false;
  const s = system as Record<string, unknown>;
  if (typeof s.id !== "string" || !s.id.startsWith("custom:")) return false;
  if (typeof s.name !== "string" || !s.name) return false;
  if (typeof s.config !== "object" || !s.config) return false;
  if (!Array.isArray(s.baseModuleIds)) return false;
  return true;
}

/** Heal a system by filling missing config fields from its basedOn preset. */
function healSystem(system: CustomSystem): CustomSystem {
  const presetId = isPresetId(system.basedOn) ? system.basedOn : "sayc";
  const preset = getSystemConfig(presetId);
  // any: legacy localStorage may have string point formula values needing migration
  const rawConfig = system.config as unknown as Record<string, unknown>;
  const rawPointConfig = rawConfig.pointConfig as Record<string, unknown> | undefined;

  // Migrate legacy string point formulas to new object format
  const defaultNt: PointFormula = { includeShortage: false, includeLength: false };
  const defaultTrump: PointFormula = { includeShortage: true, includeLength: false };
  const pointConfig = rawPointConfig ? {
    ntFormula: normalizePointFormula(rawPointConfig.ntFormula as PointFormula | string | undefined, defaultNt),
    trumpFormula: normalizePointFormula(rawPointConfig.trumpFormula as PointFormula | string | undefined, defaultTrump),
  } : preset.pointConfig;

  const config = { ...preset, ...system.config, pointConfig } as SystemConfig;

  // Filter invalid module IDs and ensure natural-bids is present
  let moduleIds = [...system.baseModuleIds];
  const knownModules = getKnownModuleIds();
  if (knownModules.size > 0) {
    moduleIds = moduleIds.filter((id) => id.startsWith("user:") || knownModules.has(id));
  }
  if (!moduleIds.includes("natural-bids")) {
    moduleIds.unshift("natural-bids");
  }

  return { ...system, config, baseModuleIds: moduleIds };
}

let cachedModuleIds: Set<string> | null = null;

function getKnownModuleIds(): Set<string> {
  if (cachedModuleIds) return cachedModuleIds;
  try {
    const modules = listModules();
    cachedModuleIds = new Set(modules.map((m) => m.moduleId));
    return cachedModuleIds;
  } catch {
    return new Set();
  }
}

function isPresetId(id: string): id is BaseSystemId {
  return AVAILABLE_BASE_SYSTEMS.some((s) => s.id === id);
}

function generateId(): `custom:${string}` {
  return `custom:${crypto.randomUUID().slice(0, 8)}`;
}

// ── Store ──────────────────────────────────────────────────────────

export function createCustomSystemsStore() {
  let systems = $state<CustomSystem[]>(loadSystems());

  function persist(): void {
    saveSystems(systems);
  }

  return {
    get systems(): readonly CustomSystem[] {
      return systems;
    },

    getSystem(id: string): CustomSystem | undefined {
      return systems.find((s) => s.id === id);
    },

    createSystem(basedOn: BaseSystemId, name?: string): CustomSystem {
      const preset = getSystemConfig(basedOn);
      const presetMeta = AVAILABLE_BASE_SYSTEMS.find((s) => s.id === basedOn);
      const systemName = name ?? `${presetMeta?.shortLabel ?? basedOn} (custom)`;
      const now = new Date().toISOString();

      const system: CustomSystem = {
        id: generateId(),
        name: systemName,
        basedOn,
        config: { ...preset, systemId: "custom" },
        baseModuleIds: [...DEFAULT_BASE_MODULE_IDS],
        createdAt: now,
        updatedAt: now,
      };

      systems = [...systems, system];
      persist();
      return system;
    },

    updateSystem(id: `custom:${string}`, patch: Partial<Pick<CustomSystem, "name" | "config" | "baseModuleIds">>): void {
      systems = systems.map((s) => {
        if (s.id !== id) return s;
        return {
          ...s,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
      });
      persist();
    },

    deleteSystem(id: `custom:${string}`): void {
      systems = systems.filter((s) => s.id !== id);
      persist();
    },

    /** Check if a system selection ID still references a valid system. */
    isValidSelection(id: SystemSelectionId): boolean {
      if (typeof id === "string" && id.startsWith("custom:")) {
        return systems.some((s) => s.id === id);
      }
      return AVAILABLE_BASE_SYSTEMS.some((s) => s.id === id);
    },

    /** Validate a custom system name. Returns error message or null if valid. */
    validateName(name: string, excludeId?: string): string | null {
      if (!name.trim()) return "Name is required";
      const duplicate = systems.some(
        (s) => s.name.toLowerCase() === name.trim().toLowerCase() && s.id !== excludeId,
      );
      if (duplicate) return "A system with this name already exists";
      return null;
    },
  };
}

// ── System resolution ──────────────────────────────────────────────

/**
 * Resolves any SystemSelectionId to the full config + base modules needed
 * for a session. Single authoritative source — all session-creating callers
 * MUST use this.
 */
export function resolveSystemForSession(
  selectionId: SystemSelectionId,
  customSystems: readonly CustomSystem[],
): { systemConfig: SystemConfig; baseModuleIds: string[] } {
  if (typeof selectionId === "string" && selectionId.startsWith("custom:")) {
    const system = customSystems.find((s) => s.id === selectionId);
    if (system) {
      return { systemConfig: system.config, baseModuleIds: [...system.baseModuleIds] };
    }
    // Fallback to SAYC if custom system not found
  }

  // Preset system
  const presetId = isPresetId(selectionId) ? selectionId : "sayc";
  return {
    systemConfig: getSystemConfig(presetId),
    baseModuleIds: [...DEFAULT_BASE_MODULE_IDS],
  };
}
