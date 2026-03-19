<script lang="ts">
  import { getAppStore } from "../../stores/context";
  import { listBundles, getBundle } from "../../conventions/core/bundle";
  import { generateOptimizedManifest } from "../../conventions/core/runtime/coverage-spec-compiler";
  import type { OptimizedCoverageManifest } from "../../conventions/core/runtime/coverage-spec-compiler";
  import type { ConventionBundle } from "../../conventions/core/bundle/bundle-types";

  const appStore = getAppStore();

  // All bundles with FSMs
  const bundles: ConventionBundle[] = [];
  for (const bundle of listBundles()) {
    if (bundle.internal) continue;
    if (!bundle.conversationMachine) continue;
    bundles.push(bundle);
  }

  // Currently selected bundle (from URL or user click)
  let selectedBundleId = $state<string | null>(appStore.coverageBundle);

  // Lazy-computed manifest for the selected bundle
  let manifest = $derived.by<OptimizedCoverageManifest | null>(() => {
    if (!selectedBundleId) return null;
    const bundle = getBundle(selectedBundleId);
    if (!bundle) return null;
    return generateOptimizedManifest(bundle, { skipFeasibilityCheck: true });
  });

  let showOptimized = $state(true);

  function selectBundle(bundleId: string) {
    selectedBundleId = bundleId;
    appStore.setCoverageBundle(bundleId);
  }

  function backToBundles() {
    selectedBundleId = null;
    appStore.setCoverageBundle(null);
  }

  function handleBack() {
    if (selectedBundleId) {
      backToBundles();
    } else {
      appStore.navigateToMenu();
    }
  }

  function targetUrl(bundleId: string, stateId: string, surfaceId?: string): string {
    const base = window.location.origin + window.location.pathname;
    let url = `${base}?convention=${bundleId}&targetState=${encodeURIComponent(stateId)}`;
    if (surfaceId) {
      url += `&targetSurface=${encodeURIComponent(surfaceId)}`;
    }
    return url;
  }

  function coverageUrl(bundleId: string): string {
    const base = window.location.origin + window.location.pathname;
    return `${base}?coverage=true&convention=${bundleId}`;
  }
</script>

<main class="h-full overflow-y-auto bg-bg-deepest text-text-primary">
  <div class="mx-auto max-w-4xl px-6 py-8">
    <!-- Header -->
    <div class="mb-8 flex items-center gap-4">
      <button
        class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
        onclick={handleBack}
        aria-label={selectedBundleId ? "Back to bundles" : "Back to menu"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
      </button>
      <div>
        {#if !selectedBundleId}
          <h1 class="text-2xl font-bold">Coverage</h1>
          <p class="text-text-secondary text-sm mt-1">
            {bundles.length} conventions with FSM coverage. Choose one to see targets.
          </p>
        {:else if manifest}
          <h1 class="text-2xl font-bold">{manifest.bundleName}</h1>
          <p class="text-text-secondary text-sm mt-1">
            {manifest.totalSurfacePairs} (state, surface) pairs &middot;
            {manifest.allTargets.length} targets &middot;
            LP bound: {manifest.treeLPBound}
          </p>
        {/if}
      </div>
    </div>

    {#if !selectedBundleId}
      <!-- ── Bundle Picker ───────────────────────────────────────── -->
      <div class="grid gap-3">
        {#each bundles as bundle (bundle.id)}
          <button
            class="block w-full text-left rounded-[--radius-md] bg-bg-card border border-border-subtle p-4 hover:border-blue-500 hover:bg-bg-card-hover transition-colors cursor-pointer group"
            onclick={() => selectBundle(bundle.id)}
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="text-lg font-semibold text-text-primary group-hover:text-blue-300">
                  {bundle.name}
                </div>
                <div class="text-sm text-text-secondary mt-1">
                  {bundle.conversationMachine?.states.size ?? 0} FSM states &middot;
                  {(bundle.meaningSurfaces ?? []).reduce((sum, g) => sum + g.surfaces.length, 0)} surfaces
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
        <p class="text-text-muted text-center py-16">No bundles with FSM machines found.</p>
      {/if}

    {:else if manifest}
      <!-- ── Bundle Detail: Coverage Targets ──────────────────────── -->

      <!-- View toggle -->
      <div class="mb-6 flex gap-2">
        <button
          class="px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer {showOptimized ? 'bg-blue-600 text-white' : 'bg-bg-card text-text-secondary hover:text-text-primary'}"
          onclick={() => showOptimized = true}
        >
          Optimized ({manifest.allTargets.length})
        </button>
        <button
          class="px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer {!showOptimized ? 'bg-blue-600 text-white' : 'bg-bg-card text-text-secondary hover:text-text-primary'}"
          onclick={() => showOptimized = false}
        >
          All States
        </button>
      </div>

      {#if showOptimized}
        <!-- Phase 1: Leaf Sweep -->
        {#if manifest.phase1Targets.length > 0}
          <h3 class="text-sm font-medium text-green-400 uppercase tracking-wider mb-2">
            Phase 1: Leaf Sweep ({manifest.phase1Targets.length} targets)
          </h3>
          <div class="grid gap-2 mb-6">
            {#each manifest.phase1Targets as target (target.stateId + ':' + (target.targetSurfaceId ?? ''))}
              <a
                href={targetUrl(manifest.bundleId, target.stateId, target.targetSurfaceId)}
                class="block rounded-[--radius-md] bg-bg-card border border-border-subtle p-3 hover:border-green-500 hover:bg-bg-card-hover transition-colors group"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="font-mono text-sm font-medium text-green-400 group-hover:text-green-300 truncate">
                      {target.stateId}
                    </div>
                    {#if target.targetSurfaceLabel}
                      <div class="text-xs text-green-300/70 mt-0.5">
                        Target: {target.targetSurfaceLabel}
                      </div>
                    {/if}
                    <div class="text-xs text-text-secondary mt-1 truncate">
                      {target.pathDescription}
                    </div>
                  </div>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-300 shrink-0">
                    covers {target.coveredPairs.length}
                  </span>
                </div>
              </a>
            {/each}
          </div>
        {/if}

        <!-- Phase 2: Gap Fill -->
        {#if manifest.phase2Targets.length > 0}
          <h3 class="text-sm font-medium text-amber-400 uppercase tracking-wider mb-2">
            Phase 2: Gap Fill ({manifest.phase2Targets.length} targets)
          </h3>
          <div class="grid gap-2 mb-6">
            {#each manifest.phase2Targets as target (target.stateId + ':' + (target.targetSurfaceId ?? ''))}
              <a
                href={targetUrl(manifest.bundleId, target.stateId, target.targetSurfaceId)}
                class="block rounded-[--radius-md] bg-bg-card border border-border-subtle p-3 hover:border-amber-500 hover:bg-bg-card-hover transition-colors group"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="font-mono text-sm font-medium text-amber-400 group-hover:text-amber-300 truncate">
                      {target.stateId}
                    </div>
                    {#if target.targetSurfaceLabel}
                      <div class="text-xs text-amber-300/70 mt-0.5">
                        Target: {target.targetSurfaceLabel}
                      </div>
                    {/if}
                    <div class="text-xs text-text-secondary mt-1 truncate">
                      {target.pathDescription}
                    </div>
                  </div>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 shrink-0">
                    covers {target.coveredPairs.length}
                  </span>
                </div>
              </a>
            {/each}
          </div>
        {/if}

        <!-- Infeasible pairs -->
        {#if manifest.infeasiblePairs.length > 0}
          <details class="mb-4">
            <summary class="text-sm font-medium text-red-400 uppercase tracking-wider mb-2 cursor-pointer">
              Infeasible ({manifest.infeasiblePairs.length})
            </summary>
            <div class="mt-2 text-sm text-text-muted">
              {#each manifest.infeasiblePairs as pair (pair.stateId + ':' + pair.surfaceId)}
                <div class="font-mono">{pair.stateId}: {pair.surfaceLabel}</div>
              {/each}
            </div>
          </details>
        {/if}

        <!-- Staleness hash -->
        <div class="text-xs text-text-muted mt-4">
          Coverage hash: <code>{manifest.coverageHash}</code>
          &middot; Shareable: <a href={coverageUrl(manifest.bundleId)} class="text-blue-400 hover:underline">
            ?coverage=true&convention={manifest.bundleId}
          </a>
        </div>

      {:else}
        <!-- All states flat list (legacy view) -->
        <div class="grid gap-2">
          {#each manifest.allTargets as target (target.stateId + ':' + (target.targetSurfaceId ?? ''))}
            <a
              href={targetUrl(manifest.bundleId, target.stateId, target.targetSurfaceId)}
              class="block rounded-md bg-bg-card/50 border border-border-subtle/50 px-3 py-2 hover:border-blue-500/50 transition-colors text-sm"
            >
              <span class="font-mono text-text-secondary">{target.stateId}</span>
              {#if target.targetSurfaceLabel}
                <span class="text-blue-400 ml-1">{target.targetSurfaceLabel}</span>
              {/if}
              <span class="text-text-muted ml-2">{target.pathDescription}</span>
            </a>
          {/each}
        </div>
      {/if}

    {:else}
      <p class="text-text-muted text-center py-16">Bundle not found.</p>
    {/if}
  </div>
</main>
