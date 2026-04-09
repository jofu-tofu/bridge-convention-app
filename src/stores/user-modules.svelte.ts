/**
 * User module store — CRUD operations for user-owned convention modules.
 * Persists to localStorage. Modules are full copies (fork model, no deltas).
 */

import type { UserModule, UserModuleMetadata, ModuleCategory } from "../service/session-types";
import { loadFromStorage, saveToStorage } from "./local-storage";

// Re-export for convenience — callers can import from the store barrel
export type { UserModule, UserModuleMetadata, ModuleCategory };

const STORAGE_KEY = "bridge-app:user-modules";

interface UserModuleStoreState {
  modules: Record<string, UserModule>;
}

const DEFAULT_STATE: UserModuleStoreState = { modules: {} };

function loadModules(): UserModuleStoreState {
  return loadFromStorage(STORAGE_KEY, DEFAULT_STATE, (raw) => {
    const parsed = raw as UserModuleStoreState;
    if (!parsed?.modules || typeof parsed.modules !== "object") return undefined;
    return parsed;
  });
}

function persistModules(state: UserModuleStoreState): void {
  saveToStorage(STORAGE_KEY, state);
}

export function createUserModuleStore() {
  let state = $state<UserModuleStoreState>(loadModules());

  function persist(): void {
    persistModules(state);
  }

  return {
    get modules(): Readonly<Record<string, UserModule>> {
      return state.modules;
    },

    getModule(moduleId: string): UserModule | undefined {
      return state.modules[moduleId];
    },

    saveModule(module: UserModule): void {
      state = { modules: { ...state.modules, [module.metadata.moduleId]: module } };
      persist();
    },

    deleteModule(moduleId: string): void {
      const { [moduleId]: _, ...rest } = state.modules;
      state = { modules: rest };
      persist();
    },

    listModules(): UserModule[] {
      return Object.values(state.modules);
    },

    listByCategory(category: ModuleCategory): UserModule[] {
      return Object.values(state.modules).filter(
        (m) => m.metadata.category === category,
      );
    },

    /** Check if a user module ID exists. */
    hasModule(moduleId: string): boolean {
      return moduleId in state.modules;
    },

    /** Get all user module IDs. */
    getModuleIds(): string[] {
      return Object.keys(state.modules);
    },
  };
}

export type UserModuleStore = ReturnType<typeof createUserModuleStore>;
