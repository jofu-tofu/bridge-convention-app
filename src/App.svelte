<script lang="ts">
  import type { DevServicePort } from "./service";
  import { BridgeService } from "./service";
  import { applyDevParams } from "./stores/dev-params";
  import { createGameStore } from "./stores/game.svelte";
  import { createAppStore } from "./stores/app.svelte";
  import { createCustomSystemsStore } from "./stores/custom-systems.svelte";
  import AppShell from "./AppShell.svelte";

  let engineReady = $state(false);
  let initError = $state<string | null>(null);
  let resolvedService = $state<DevServicePort | null>(null);
  let resolvedGameStore = $state<ReturnType<typeof createGameStore> | null>(null);
  let appStore = $state<ReturnType<typeof createAppStore> | null>(null);
  let customSystemsStore = $state<ReturnType<typeof createCustomSystemsStore> | null>(null);

  function init(): void {
    engineReady = false;
    initError = null;
    const svc = new BridgeService();
    svc.init()
      .then(() => {
        resolvedService = svc;
        const store = createAppStore();
        appStore = store;
        customSystemsStore = createCustomSystemsStore();
        // Validate stored custom system selection still exists
        if (!customSystemsStore.isValidSelection(store.baseSystemId)) {
          store.setBaseSystemId("sayc");
        }
        resolvedGameStore = createGameStore(svc);
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
{:else if !engineReady || !resolvedService || !resolvedGameStore || !appStore || !customSystemsStore}
  <div class="bg-bg-deepest text-text-primary flex h-screen items-center justify-center">
    Loading engine...
  </div>
{:else}
  <AppShell service={resolvedService} gameStore={resolvedGameStore} {appStore} {customSystemsStore} />
{/if}
