<script lang="ts">
  import { getAppStore } from "../../stores/context";
  import { listConventions, listModules } from "../../service";
  import type { ModuleCatalogEntry } from "../../service";
  import AppScreen from "../shared/AppScreen.svelte";

  const appStore = getAppStore();

  const bundles = listConventions();

  let selectedBundleId = $state<string | null>(appStore.coverageBundle);

  const allModules: readonly ModuleCatalogEntry[] = listModules();

  let selectedBundle = $derived(
    selectedBundleId ? bundles.find(b => b.id === selectedBundleId) ?? null : null,
  );

  let bundleModules = $derived.by(() => {
    if (!selectedBundle?.moduleIds) return [];
    const ids = new Set(selectedBundle.moduleIds);
    return allModules.filter(m => ids.has(m.moduleId));
  });

  function selectBundle(bundleId: string) {
    selectedBundleId = bundleId;
    appStore.setCoverageBundle(bundleId);
  }

  function backToBundles() {
    selectedBundleId = null;
    appStore.setCoverageBundle(null);
  }

  function coverageUrl(bundleId: string): string {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?screen=coverage&convention=${bundleId}`;
  }

  const screenTitle = $derived(
    selectedBundle ? selectedBundle.name : "Coverage",
  );
  const screenSubtitle = $derived(
    selectedBundle
      ? `${bundleModules.length} modules`
      : `${bundles.length} conventions. Choose one to see modules.`,
  );
</script>

<AppScreen title={screenTitle} subtitle={screenSubtitle} width="custom">
  {#snippet actions()}
    {#if selectedBundleId}
      <button
        class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
        onclick={backToBundles}
        aria-label="Back to conventions"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
      </button>
    {/if}
  {/snippet}

  {#if !selectedBundleId}
    <div class="grid gap-3">
      {#each bundles as bundle (bundle.id)}
        <button
          class="block w-full text-left rounded-[--radius-lg] bg-bg-card border border-border-subtle p-4 hover:border-blue-500 hover:bg-bg-hover transition-colors cursor-pointer group"
          onclick={() => selectBundle(bundle.id)}
        >
          <div class="flex items-center justify-between">
            <div>
              <div class="text-lg font-semibold text-text-primary group-hover:text-blue-300">
                {bundle.name}
              </div>
              <div class="text-sm text-text-secondary mt-1">
                {bundle.moduleIds?.length ?? 0} modules
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              class="text-text-muted group-hover:text-blue-400 transition-colors" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </button>
      {/each}
    </div>

    {#if bundles.length === 0}
      <p class="text-text-muted text-center py-16">No convention bundles found.</p>
    {/if}

  {:else if selectedBundle}
    <div class="grid gap-3">
      {#each bundleModules as mod (mod.moduleId)}
        <div class="rounded-[--radius-lg] bg-bg-card border border-border-subtle p-4">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="font-mono text-sm font-medium text-green-400">
                {mod.displayName}
              </div>
              <div class="text-sm text-text-secondary mt-1">
                {mod.description}
              </div>
              <div class="text-xs text-text-muted mt-1">
                {mod.surfaceCount} surfaces
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>

    {#if bundleModules.length === 0}
      <p class="text-text-muted text-center py-16">No modules found for this bundle.</p>
    {/if}

    <div class="text-xs text-text-muted mt-4">
      Shareable: <a href={coverageUrl(selectedBundle.id)} class="text-blue-400 hover:underline">
        ?screen=coverage&convention={selectedBundle.id}
      </a>
    </div>

  {:else}
    <p class="text-text-muted text-center py-16">Convention not found.</p>
  {/if}
</AppScreen>
