<script lang="ts">
  import { onMount } from "svelte";
  import { TsEngine } from "./engine/ts-engine";
  import { TauriIpcEngine } from "./engine/tauri-ipc-engine";
  import { HttpEngine } from "./engine/http-engine";
  import type { EnginePort } from "./engine/port";
  import { createGameStore } from "./stores/game.svelte";
  import { createAppStore } from "./stores/app.svelte";
  import { setEngine, setGameStore, setAppStore } from "./lib/context";
  import { getConvention } from "./conventions/registry";
  import ConventionSelectScreen from "./components/screens/ConventionSelectScreen.svelte";
  import GameScreen from "./components/screens/game-screen/GameScreen.svelte";

  // Runtime engine detection: Tauri IPC → HTTP (Rust) → TS fallback
  function createEngine(): EnginePort {
    if ((window as any).__TAURI__) {
      return new TauriIpcEngine();
    }
    return createFallbackEngine(
      new HttpEngine("http://localhost:3001"),
      new TsEngine(),
    );
  }

  /** Proxy that tries primary engine first, falls back to secondary on network errors. */
  function createFallbackEngine(primary: EnginePort, fallback: EnginePort): EnginePort {
    let useFallback = false;
    return new Proxy(primary, {
      get(target, prop, receiver) {
        const engine = useFallback ? fallback : target;
        const value = Reflect.get(engine, prop, receiver);
        if (typeof value !== "function") return value;
        return async (...args: unknown[]) => {
          if (useFallback) {
            return (value as Function).apply(engine, args);
          }
          try {
            return await (value as Function).apply(engine, args);
          } catch (err) {
            if (err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("network"))) {
              console.warn("[engine] Rust server unreachable, falling back to TsEngine");
              useFallback = true;
              const fallbackValue = Reflect.get(fallback, prop, receiver);
              return (fallbackValue as Function).apply(fallback, args);
            }
            throw err;
          }
        };
      },
    });
  }

  const engine = createEngine();
  const gameStore = createGameStore(engine);
  const appStore = createAppStore();

  setEngine(engine);
  setGameStore(gameStore);
  setAppStore(appStore);

  if (import.meta.env.DEV) {
    onMount(() => {
      const params = new URLSearchParams(window.location.search);

      const seedParam = params.get("seed");
      if (seedParam != null) {
        const seed = Number(seedParam);
        if (Number.isFinite(seed)) {
          appStore.setDevSeed(seed);
        }
      }

      const debugParam = params.get("debug");
      if (debugParam === "true") {
        appStore.setDebugPanel(true);
      }

      const conventionParam = params.get("convention");
      if (conventionParam) {
        try {
          const config = getConvention(conventionParam);
          appStore.selectConvention(config);
        } catch (e) {
          console.warn(`[dev] Unknown convention "${conventionParam}":`, e);
        }
      }
    });
  }
</script>

<div class="min-h-screen bg-bg-deepest text-text-primary font-sans">
  {#if appStore.screen === "select"}
    <ConventionSelectScreen />
  {:else if appStore.screen === "game"}
    <GameScreen />
  {/if}
</div>
