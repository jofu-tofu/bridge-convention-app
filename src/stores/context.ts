import { setContext, getContext } from "svelte";
import type { GameStore } from "./types";
import type { createAppStore } from "../stores/app.svelte";
import type { createCustomSystemsStore } from "../stores/custom-systems.svelte";
import type { createUserModuleStore } from "../stores/user-modules.svelte";
import type { createAuthStore } from "../stores/auth.svelte";
import type { createPracticePacksStore } from "../stores/practice-packs.svelte";
import type { createDrillPresetsStore } from "../stores/drill-presets.svelte";
import type { createCustomDrillsStore } from "../stores/custom-drills.svelte";
import type { LayoutProps } from "../components/shared/layout-props";
import type { DataPort, DevServicePort } from "../service";

type AppStore = ReturnType<typeof createAppStore>;
type CustomSystemsStore = ReturnType<typeof createCustomSystemsStore>;
type UserModuleStore = ReturnType<typeof createUserModuleStore>;
type AuthStore = ReturnType<typeof createAuthStore>;
type PracticePacksStore = ReturnType<typeof createPracticePacksStore>;
type DrillPresetsStore = ReturnType<typeof createDrillPresetsStore>;
type CustomDrillsStore = ReturnType<typeof createCustomDrillsStore>;

const GAME_STORE_KEY = Symbol("game-store");
const APP_STORE_KEY = Symbol("app-store");
const SERVICE_KEY = Symbol("service");
const LAYOUT_KEY = Symbol("layout");
const CUSTOM_SYSTEMS_KEY = Symbol("custom-systems");
const USER_MODULES_KEY = Symbol("user-modules");
const AUTH_STORE_KEY = Symbol("auth-store");
const DATA_PORT_KEY = Symbol("data-port");
const PRACTICE_PACKS_KEY = Symbol("practice-packs");
const DRILL_PRESETS_KEY = Symbol("drill-presets");
const CUSTOM_DRILLS_KEY = Symbol("custom-drills");

// Game store context
export function setGameStore(store: GameStore): void {
  setContext(GAME_STORE_KEY, store);
}

export function getGameStore(): GameStore {
  return getContext<GameStore>(GAME_STORE_KEY);
}

// App store context
export function setAppStore(store: AppStore): void {
  setContext(APP_STORE_KEY, store);
}

export function getAppStore(): AppStore {
  return getContext<AppStore>(APP_STORE_KEY);
}

/** Returns the app store if set, or undefined. Used by nav chrome shared across layouts. */
export function getAppStoreOptional(): AppStore | undefined {
  return getContext<AppStore | undefined>(APP_STORE_KEY);
}

// Service context
export function setService(service: DevServicePort): void {
  setContext(SERVICE_KEY, service);
}

export function getService(): DevServicePort {
  return getContext<DevServicePort>(SERVICE_KEY);
}

// Layout context
export function setLayoutConfig(config: LayoutProps): void {
  setContext(LAYOUT_KEY, config);
}

export function getLayoutConfig(): LayoutProps {
  return getContext<LayoutProps>(LAYOUT_KEY);
}

// Custom systems store context
export function setCustomSystemsStore(store: CustomSystemsStore): void {
  setContext(CUSTOM_SYSTEMS_KEY, store);
}

export function getCustomSystemsStore(): CustomSystemsStore {
  return getContext<CustomSystemsStore>(CUSTOM_SYSTEMS_KEY);
}

// User module store context
export function setUserModuleStore(store: UserModuleStore): void {
  setContext(USER_MODULES_KEY, store);
}

export function getUserModuleStore(): UserModuleStore {
  return getContext<UserModuleStore>(USER_MODULES_KEY);
}

// Auth store context
export function setAuthStore(store: AuthStore): void {
  setContext(AUTH_STORE_KEY, store);
}

export function getAuthStore(): AuthStore {
  return getContext<AuthStore>(AUTH_STORE_KEY);
}

/** Returns the auth store if set, or undefined. Used by shared nav chrome during SSR/prerender. */
export function getAuthStoreOptional(): AuthStore | undefined {
  return getContext<AuthStore | undefined>(AUTH_STORE_KEY);
}

// DataPort context
export function setDataPort(dataPort: DataPort): void {
  setContext(DATA_PORT_KEY, dataPort);
}

export function getDataPort(): DataPort {
  return getContext<DataPort>(DATA_PORT_KEY);
}

// Practice packs store context
export function setPracticePacksStore(store: PracticePacksStore): void {
  setContext(PRACTICE_PACKS_KEY, store);
}

export function getPracticePacksStore(): PracticePacksStore {
  return getContext<PracticePacksStore>(PRACTICE_PACKS_KEY);
}

// Drill presets store context
export function setDrillPresetsStore(store: DrillPresetsStore): void {
  setContext(DRILL_PRESETS_KEY, store);
}

export function getDrillPresetsStore(): DrillPresetsStore {
  return getContext<DrillPresetsStore>(DRILL_PRESETS_KEY);
}

// Custom drills store context
export function setCustomDrillsStore(store: CustomDrillsStore): void {
  setContext(CUSTOM_DRILLS_KEY, store);
}

export function getCustomDrillsStore(): CustomDrillsStore {
  return getContext<CustomDrillsStore>(CUSTOM_DRILLS_KEY);
}
