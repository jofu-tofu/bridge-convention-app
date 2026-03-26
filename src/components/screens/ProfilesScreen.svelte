<script lang="ts">
  import type { BaseSystemId } from "../../service";
  import { AVAILABLE_BASE_SYSTEMS, getSystemConfig } from "../../service";
  import { getAppStore } from "../../stores/context";
  import SystemDetailView from "./SystemDetailView.svelte";
  import SystemCompareView from "./SystemCompareView.svelte";

  const appStore = getAppStore();

  let selectedSystem = $state<BaseSystemId>("sayc");
  let compareMode = $state(false);

  const config = $derived(getSystemConfig(selectedSystem));
  const selectedMeta = $derived(AVAILABLE_BASE_SYSTEMS.find((s) => s.id === selectedSystem)!);
</script>

<main class="max-w-3xl mx-auto h-full flex flex-col p-6 pb-0" aria-label="Base System Profiles">
  <div class="shrink-0">
    <!-- Header -->
    <h1 class="text-3xl font-bold tracking-tight text-text-primary mb-1">Base Profiles</h1>
    <p class="text-text-secondary mb-5">System thresholds and bidding parameters.</p>

    <!-- Tab bar -->
    <div class="flex items-center gap-1 mb-5 p-1 rounded-[--radius-lg] bg-bg-card border border-border-subtle">
      {#each AVAILABLE_BASE_SYSTEMS as sys (sys.id)}
        <button
          class="flex-1 py-2 rounded-[--radius-md] text-sm font-semibold transition-all cursor-pointer
            {!compareMode && selectedSystem === sys.id
              ? 'bg-accent-primary text-text-on-accent shadow-[--shadow-sm]'
              : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated/50'}"
          aria-pressed={!compareMode && selectedSystem === sys.id}
          onclick={() => { selectedSystem = sys.id as BaseSystemId; compareMode = false; }}
          data-testid="profile-tab-{sys.id}"
        >
          {sys.shortLabel}
        </button>
      {/each}
      <span class="w-px h-5 bg-border-subtle mx-1" aria-hidden="true"></span>
      <button
        class="px-4 py-2 rounded-[--radius-md] text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5
          {compareMode
            ? 'bg-accent-primary text-text-on-accent shadow-[--shadow-sm]'
            : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated/50'}"
        aria-pressed={compareMode}
        onclick={() => compareMode = !compareMode}
        data-testid="profile-compare-toggle"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/></svg>
        Compare
      </button>
    </div>

    {#if !compareMode}
      <div class="flex items-center gap-2 mb-4 ml-1">
        <span class="w-2 h-2 rounded-full bg-accent-primary" aria-hidden="true"></span>
        <p class="text-sm text-text-secondary">{selectedMeta.label}</p>
      </div>
    {:else}
      <div class="flex items-center gap-2 mb-4 ml-1">
        <span class="w-2 h-2 rounded-full bg-accent-primary" aria-hidden="true"></span>
        <p class="text-sm text-text-secondary">Differences highlighted across all three systems.</p>
      </div>
    {/if}
  </div>

  <div class="flex-1 overflow-y-auto pb-6">
    {#if compareMode}
      <SystemCompareView />
    {:else}
      {#key selectedSystem}
        <SystemDetailView {config} />
      {/key}
    {/if}
  </div>
</main>
