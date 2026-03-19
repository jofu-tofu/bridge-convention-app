import { setContext, getContext } from "svelte";
import type { EnginePort } from "../engine/port";
import type { createGameStore } from "../stores/game.svelte";
import type { createAppStore } from "../stores/app.svelte";
import type { LayoutProps } from "../core/display/layout-props";

type GameStore = ReturnType<typeof createGameStore>;
type AppStore = ReturnType<typeof createAppStore>;

const ENGINE_KEY = Symbol("engine");
const GAME_STORE_KEY = Symbol("game-store");
const APP_STORE_KEY = Symbol("app-store");
const LAYOUT_KEY = Symbol("layout");

// Engine context
export function setEngine(engine: EnginePort): void {
  setContext(ENGINE_KEY, engine);
}

export function getEngine(): EnginePort {
  return getContext<EnginePort>(ENGINE_KEY);
}

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

// Layout context
export function setLayoutConfig(config: LayoutProps): void {
  setContext(LAYOUT_KEY, config);
}

export function getLayoutConfig(): LayoutProps {
  return getContext<LayoutProps>(LAYOUT_KEY);
}
