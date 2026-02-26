import { setContext, getContext } from "svelte";
import type { EnginePort } from "../engine/port";
import type { createGameStore } from "../stores/game.svelte";
import type { createAppStore } from "../stores/app.svelte";

type GameStore = ReturnType<typeof createGameStore>;
type AppStore = ReturnType<typeof createAppStore>;

const ENGINE_KEY = Symbol("engine");
const GAME_STORE_KEY = Symbol("game-store");
const APP_STORE_KEY = Symbol("app-store");

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
