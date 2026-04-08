import { setContext, getContext } from "svelte";
import type { GameStore } from "./types";
import type { createAppStore } from "../stores/app.svelte";
import type { createCustomSystemsStore } from "../stores/custom-systems.svelte";
import type { createUserModuleStore } from "../stores/user-modules.svelte";
import type { LayoutProps } from "../components/shared/layout-props";
import type { DevServicePort } from "../service";

type AppStore = ReturnType<typeof createAppStore>;
type CustomSystemsStore = ReturnType<typeof createCustomSystemsStore>;
type UserModuleStore = ReturnType<typeof createUserModuleStore>;

const GAME_STORE_KEY = Symbol("game-store");
const APP_STORE_KEY = Symbol("app-store");
const SERVICE_KEY = Symbol("service");
const LAYOUT_KEY = Symbol("layout");
const CUSTOM_SYSTEMS_KEY = Symbol("custom-systems");
const USER_MODULES_KEY = Symbol("user-modules");

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
