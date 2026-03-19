<script lang="ts">
  import type { EnginePort } from "./engine/port";
  import { createEngine } from "./engine/create-engine";
  import { applyDevParams } from "./stores/dev-params";
  import { createGameStore } from "./stores/game.svelte";
  import { createAppStore } from "./stores/app.svelte";
  import AppShell from "./AppShell.svelte";

  let engineReady = $state(false);
  let initError = $state<string | null>(null);
  let resolvedEngine = $state<EnginePort | null>(null);
  let resolvedGameStore = $state<ReturnType<typeof createGameStore> | null>(null);
  let appStore = $state<ReturnType<typeof createAppStore> | null>(null);

  function init(): void {
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
  }

  init();
</script>

{#if initError}
  <div class="bg-bg-deepest text-red-400 flex h-screen flex-col items-center justify-center gap-4">
    <p>{initError}</p>
    <button
      class="rounded bg-red-800 px-4 py-2 text-white hover:bg-red-700"
      onclick={() => init()}
    >Retry</button>
  </div>
{:else if !engineReady || !resolvedEngine || !resolvedGameStore || !appStore}
  <div class="bg-bg-deepest text-text-primary flex h-screen items-center justify-center">
    Loading engine...
  </div>
{:else}
  <AppShell engine={resolvedEngine} gameStore={resolvedGameStore} {appStore} />
{/if}
