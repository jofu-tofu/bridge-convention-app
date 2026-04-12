<script lang="ts">
  import type { DevServicePort, DataPort } from "../../service";
  import { BridgeService, DataPortClient, DevDataPort, SubscriptionTier } from "../../service";
  import { applyDevParams, getDevAuthOverride } from "../../stores/dev-params";
  import { createGameStore } from "../../stores/game.svelte";
  import { createAppStore } from "../../stores/app.svelte";
  import { createCustomSystemsStore } from "../../stores/custom-systems.svelte";
  import { createUserModuleStore } from "../../stores/user-modules.svelte";
  import { createPracticePacksStore } from "../../stores/practice-packs.svelte";
  import { createAuthStore } from "../../stores/auth.svelte";
  import AppShell from "../../components/navigation/AppShell.svelte";
  import AppReady from "../../AppReady.svelte";

  const { children } = $props();

  let engineReady = $state(false);
  let initError = $state<string | null>(null);
  let resolvedService = $state<DevServicePort | null>(null);
  let resolvedGameStore = $state<ReturnType<typeof createGameStore> | null>(null);
  let appStore = $state<ReturnType<typeof createAppStore> | null>(null);
  let customSystemsStore = $state<ReturnType<typeof createCustomSystemsStore> | null>(null);
  let userModuleStore = $state<ReturnType<typeof createUserModuleStore> | null>(null);
  let practicePacksStore = $state<ReturnType<typeof createPracticePacksStore> | null>(null);
  let authStore = $state<ReturnType<typeof createAuthStore> | null>(null);

  function init(): void {
    engineReady = false;
    initError = null;
    const svc = new BridgeService();

    // Auth store created immediately (non-blocking, parallel with WASM init)
    const devAuthTier = getDevAuthOverride() ?? (import.meta.env.DEV ? SubscriptionTier.Premium : null);
    const dataPort: DataPort = devAuthTier
      ? new DevDataPort(devAuthTier)
      : new DataPortClient();
    authStore = createAuthStore(dataPort);

    svc.init()
      .then(() => {
        resolvedService = svc;
        const store = createAppStore();
        appStore = store;
        customSystemsStore = createCustomSystemsStore();
        userModuleStore = createUserModuleStore();
        practicePacksStore = createPracticePacksStore();
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
{:else if !engineReady || !resolvedService || !resolvedGameStore || !appStore || !customSystemsStore || !userModuleStore || !practicePacksStore || !authStore}
  <div class="bg-bg-deepest text-text-primary flex h-screen items-center justify-center">
    Loading engine...
  </div>
{:else}
  <AppReady
    service={resolvedService}
    gameStore={resolvedGameStore}
    {appStore}
    {customSystemsStore}
    {userModuleStore}
    {practicePacksStore}
    {authStore}
  >
    <div class="bg-bg-deepest text-text-primary h-screen overflow-hidden font-sans">
      <AppShell>
        {@render children()}
      </AppShell>
    </div>
  </AppReady>
{/if}
