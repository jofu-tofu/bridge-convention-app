<script lang="ts">
  import { onMount } from "svelte";
  import { TauriIpcEngine } from "./engine/tauri-ipc-engine";
  import { HttpEngine } from "./engine/http-engine";
  import type { EnginePort } from "./engine/port";
  import { createGameStore } from "./stores/game.svelte";
  import { createAppStore } from "./stores/app.svelte";
  import { setEngine, setGameStore, setAppStore } from "./lib/context";
  import { getConvention } from "./conventions/registry";
  import ConventionSelectScreen from "./components/screens/ConventionSelectScreen.svelte";
  import GameScreen from "./components/screens/game-screen/GameScreen.svelte";

  // Runtime engine detection: Tauri IPC (desktop) or HTTP (dev/browser)
  function createEngine(): EnginePort {
    if ((window as any).__TAURI__) {
      return new TauriIpcEngine();
    }
    // In dev mode, Vite proxies /api to the Rust server — use same origin
    const rustUrl = import.meta.env.DEV ? "" : "http://localhost:3001";
    return new HttpEngine(rustUrl);
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

      // Probe Rust server connectivity (via Vite proxy in dev)
      const controller = new AbortController();
      fetch("/api/evaluate_hand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hand: { cards: [] } }),
        signal: controller.signal,
      })
        .then((res) => {
          const status = `Rust engine: ${res.ok ? "connected" : `HTTP ${res.status}`} | DDS: available`;
          appStore.setEngineStatus(status);
          console.log(`[engine] ${status}`);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          const status = `Rust engine: UNREACHABLE (${err.message})`;
          appStore.setEngineStatus(status);
          appStore.setEngineError(
            "Rust server not running. Start it with: npm run dev:web",
          );
          console.error(`[engine] ${status}`);
        });

      return () => controller.abort();
    });
  }
</script>

<div class="h-screen overflow-hidden bg-bg-deepest text-text-primary font-sans">
  {#if appStore.engineError}
    <div
      class="bg-red-700 text-white px-4 py-2 text-center text-sm font-medium"
    >
      {appStore.engineError}
    </div>
  {/if}
  {#if appStore.screen === "select"}
    <ConventionSelectScreen />
  {:else if appStore.screen === "game"}
    <GameScreen />
  {/if}
</div>
