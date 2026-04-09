/**
 * Practice packs store — CRUD operations for custom practice packs.
 * Persists to localStorage. Each pack is a named, ordered list of convention module IDs.
 */

import type { CustomPracticePack } from "../service/session-types";
import { loadFromStorage, saveToStorage } from "./local-storage";

const STORAGE_KEY = "bridge-app:practice-packs";

interface StoredPacks {
  packs: CustomPracticePack[];
}

function loadPacks(): CustomPracticePack[] {
  return loadFromStorage(STORAGE_KEY, [] as CustomPracticePack[], (raw) => {
    const parsed = raw as StoredPacks;
    if (!Array.isArray(parsed?.packs)) return undefined;
    return parsed.packs.filter(validateStoredPack);
  });
}

function savePacks(packs: CustomPracticePack[]): void {
  const data: StoredPacks = { packs };
  saveToStorage(STORAGE_KEY, data);
}

function validateStoredPack(pack: unknown): pack is CustomPracticePack {
  if (!pack || typeof pack !== "object") return false;
  const p = pack as Record<string, unknown>;
  if (typeof p.id !== "string" || !p.id.startsWith("practice-pack:")) return false;
  if (typeof p.name !== "string" || !p.name) return false;
  if (!Array.isArray(p.conventionIds)) return false;
  return true;
}

function generateId(): `practice-pack:${string}` {
  return `practice-pack:${crypto.randomUUID().slice(0, 8)}`;
}

export function createPracticePacksStore() {
  let packs = $state<CustomPracticePack[]>(loadPacks());

  function persist(): void {
    savePacks(packs);
  }

  return {
    get packs(): readonly CustomPracticePack[] {
      return packs;
    },

    getPack(id: string): CustomPracticePack | undefined {
      return packs.find((p) => p.id === id);
    },

    createPack(params: { name: string; description: string; conventionIds: string[]; basedOn?: string | null }): CustomPracticePack {
      const now = new Date().toISOString();
      const pack: CustomPracticePack = {
        id: generateId(),
        name: params.name,
        description: params.description,
        basedOn: params.basedOn ?? null,
        conventionIds: params.conventionIds,
        createdAt: now,
        updatedAt: now,
      };
      packs = [...packs, pack];
      persist();
      return pack;
    },

    updatePack(id: string, patch: { name?: string; description?: string; conventionIds?: string[] }): void {
      packs = packs.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
      });
      persist();
    },

    deletePack(id: string): void {
      packs = packs.filter((p) => p.id !== id);
      persist();
    },

    validateName(name: string, excludeId?: string): string | null {
      if (!name.trim()) return "Name is required";
      const duplicate = packs.some(
        (p) => p.name.toLowerCase() === name.trim().toLowerCase() && p.id !== excludeId,
      );
      if (duplicate) return "A practice pack with this name already exists";
      return null;
    },
  };
}

export type PracticePacksStore = ReturnType<typeof createPracticePacksStore>;
