<script lang="ts">
  import type { EnginePort } from "./engine/port";
  import type { DevServicePort } from "./service";
  import { createEngine } from "./engine/create-engine";
  import { createLocalService } from "./service";
  import { applyDevParams } from "./stores/dev-params";
  import { createGameStore } from "./stores/game.svelte";
  import { createAppStore } from "./stores/app.svelte";
  import AppShell from "./AppShell.svelte";

  let engineReady = $state(false);
  let initError = $state<string | null>(null);
  let resolvedEngine = $state<EnginePort | null>(null);
  let resolvedService = $state<DevServicePort | null>(null);
  let resolvedGameStore = $state<ReturnType<typeof createGameStore> | null>(null);
  let appStore = $state<ReturnType<typeof createAppStore> | null>(null);

  function init(): void {
    engineReady = false;
    initError = null;
    createEngine()
      .then((eng) => {
        resolvedEngine = eng;
        const svc = createLocalService(eng);
        resolvedService = svc;
        resolvedGameStore = createGameStore(svc);
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
{:else if !engineReady || !resolvedEngine || !resolvedService || !resolvedGameStore || !appStore}
  <div class="bg-bg-deepest text-text-primary flex h-screen items-center justify-center">
    Loading engine...
  </div>
{:else}
  <AppShell engine={resolvedEngine} service={resolvedService} gameStore={resolvedGameStore} {appStore} />
{/if}
