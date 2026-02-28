<script lang="ts">
  import { TauriIpcEngine } from "./engine/tauri-ipc-engine";
  import { WasmEngine, initWasm } from "./engine/wasm-engine";
  import { initDDS } from "./engine/dds-client";
  import type { EnginePort } from "./engine/port";
  import { createGameStore } from "./stores/game.svelte";
  import { createAppStore } from "./stores/app.svelte";
  import { getConvention } from "./conventions/core/registry";
  import AppShell from "./AppShell.svelte";

  // Runtime engine detection: Tauri IPC (desktop) or WASM (browser)
  async function createEngine(): Promise<EnginePort> {
    if ((window as any).__TAURI__) { // any: Tauri runtime global, not typed
      return new TauriIpcEngine();
    }
    await initWasm();
    // Fire-and-forget: DDS loads in background via Web Worker.
    // If user reaches EXPLANATION before worker is ready, isDDSAvailable()
    // returns false, DDS store catches the error, UI shows gracefully.
    initDDS().catch(() => {/* silent — isDDSAvailable() stays false, UI degrades gracefully */});
    return new WasmEngine();
  }

  let engineReady = $state(false);
  let initError = $state<string | null>(null);
  let resolvedEngine = $state<EnginePort | null>(null);
  let resolvedGameStore = $state<ReturnType<typeof createGameStore> | null>(null);
  let appStore = $state<ReturnType<typeof createAppStore> | null>(null);

  function applyDevParams(store: ReturnType<typeof createAppStore>): void {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);

    const seedParam = params.get("seed");
    if (seedParam != null) {
      const seed = Number(seedParam);
      if (Number.isFinite(seed)) {
        store.setDevSeed(seed);
      }
    }

    const debugParam = params.get("debug");
    if (debugParam === "true") {
      store.setDebugPanel(true);
    }

    const autoplayParam = params.get("autoplay");
    if (autoplayParam === "true") {
      store.setAutoplay(true);
    }

    const conventionParam = params.get("convention");
    const learnParam = params.get("learn");
    if (learnParam) {
      try {
        const config = getConvention(learnParam);
        store.navigateToLearning(config);
      } catch {
        // Invalid dev param — silently ignore
      }
    } else if (conventionParam) {
      try {
        const config = getConvention(conventionParam);
        store.selectConvention(config);
      } catch {
        // Invalid dev param — silently ignore
      }
    }
  }

  createEngine()
    .then((eng) => {
      resolvedEngine = eng;
      resolvedGameStore = createGameStore(eng);
      const store = createAppStore();
      appStore = store;
      applyDevParams(store);
      engineReady = true;
    })
    .catch((err: unknown) => {
      initError = `Failed to load engine: ${err instanceof Error ? err.message : String(err)}`;
    });
</script>

{#if initError}
  <div class="bg-bg-deepest text-red-400 flex h-screen flex-col items-center justify-center gap-4">
    <p>{initError}</p>
    <button
      class="rounded bg-red-800 px-4 py-2 text-white hover:bg-red-700"
      onclick={() => {
        initError = null;
        createEngine()
          .then((eng) => {
            resolvedEngine = eng;
            resolvedGameStore = createGameStore(eng);
            const store = createAppStore();
            appStore = store;
            applyDevParams(store);
            engineReady = true;
          })
          .catch((err: unknown) => {
            initError = `Failed to load engine: ${err instanceof Error ? err.message : String(err)}`;
          });
      }}
    >Retry</button>
  </div>
{:else if !engineReady || !resolvedEngine || !resolvedGameStore || !appStore}
  <div class="bg-bg-deepest text-text-primary flex h-screen items-center justify-center">
    Loading engine...
  </div>
{:else}
  <AppShell engine={resolvedEngine} gameStore={resolvedGameStore} {appStore} />
{/if}
