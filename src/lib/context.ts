import { setContext, getContext } from "svelte";
import type { EnginePort } from "../engine/port";

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

// Game store context — typed generically since the store shape is defined in stores/game.svelte.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setGameStore(store: any): void { // any: store type defined in game.svelte.ts
  setContext(GAME_STORE_KEY, store);
}

export function getGameStore(): ReturnType<typeof import("../stores/game.svelte").createGameStore> {
  // any: typed at call site
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getContext<any>(GAME_STORE_KEY);
}

// App store context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setAppStore(store: any): void { // any: store type defined in app.svelte.ts
  setContext(APP_STORE_KEY, store);
}

export function getAppStore(): ReturnType<typeof import("../stores/app.svelte").createAppStore> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getContext<any>(APP_STORE_KEY);
}
