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

  // Runtime engine detection: Tauri IPC → HTTP server → TS fallback
  function createEngine(): EnginePort {
    if ((window as any).__TAURI__) {
      return new TauriIpcEngine();
    }
    // In dev mode with bridge-server running, use HTTP engine
    // Fallback to TsEngine for pure browser mode without server
    return new TsEngine();
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
