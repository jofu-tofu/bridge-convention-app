<script lang="ts">
  import { getAppStore } from "../../stores/context";
  import { listBundles } from "../../conventions/core/bundle";
  import { generateCoverageManifest, generateOptimizedManifest } from "../../conventions/core/runtime/coverage-spec-compiler";
  import type { CoverageManifest, CoverageTarget, OptimizedCoverageManifest, SurfaceCoverageTarget } from "../../conventions/core/runtime/coverage-spec-compiler";

  const appStore = getAppStore();

  // Generate both manifests for all bundles on mount
  const manifests: CoverageManifest[] = [];
  const optimizedManifests: OptimizedCoverageManifest[] = [];
  for (const bundle of listBundles()) {
    if (bundle.internal) continue;
    if (!bundle.conversationMachine) continue;
    const manifest = generateCoverageManifest(bundle);
    if (manifest) manifests.push(manifest);
    const optimized = generateOptimizedManifest(bundle, { skipFeasibilityCheck: true });
    if (optimized) optimizedManifests.push(optimized);
  }

  const totalStates = manifests.reduce((sum, m) => sum + m.targetableStates, 0);
  const totalOptimizedTargets = optimizedManifests.reduce((sum, m) => sum + m.allTargets.length, 0);
  const totalSurfacePairs = optimizedManifests.reduce((sum, m) => sum + m.totalSurfacePairs, 0);

  let showOptimized = $state(true);

  function targetUrl(bundleId: string, stateId: string, surfaceId?: string): string {
    const base = window.location.origin + window.location.pathname;
    let url = `${base}?convention=${bundleId}&targetState=${encodeURIComponent(stateId)}`;
    if (surfaceId) {
      url += `&targetSurface=${encodeURIComponent(surfaceId)}`;
    }
    return url;
  }

  function handleBack() {
    appStore.navigateToMenu();
  }

  /** Group targets by whether they have surfaces (decision states vs pass-through). */
  function categorize(targets: readonly CoverageTarget[]): {
    decision: CoverageTarget[];
    passThrough: CoverageTarget[];
  } {
    const decision: CoverageTarget[] = [];
    const passThrough: CoverageTarget[] = [];
    for (const t of targets) {
      if (t.surfaceGroupId && t.activeSurfaces.length > 0) {
        decision.push(t);
      } else {
        passThrough.push(t);
      }
    }
    return { decision, passThrough };
  }
</script>

<main class="h-full overflow-y-auto bg-bg-deepest text-text-primary">
  <div class="mx-auto max-w-4xl px-6 py-8">
    <!-- Header -->
    <div class="mb-8 flex items-center gap-4">
      <button
        class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
        onclick={handleBack}
        aria-label="Back to menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
      </button>
      <div>
        <h1 class="text-2xl font-bold">FSM Coverage Targets</h1>
        <p class="text-text-secondary text-sm mt-1">
          {#if showOptimized}
            {totalOptimizedTargets} optimized targets covering {totalSurfacePairs} (state, surface) pairs across {optimizedManifests.length} bundles.
          {:else}
            {totalStates} targetable states across {manifests.length} bundles. Click any state to generate a deal targeting it.
          {/if}
        </p>
      </div>
    </div>

    <!-- View toggle -->
    <div class="mb-6 flex gap-2">
      <button
        class="px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer {showOptimized ? 'bg-blue-600 text-white' : 'bg-bg-card text-text-secondary hover:text-text-primary'}"
        onclick={() => showOptimized = true}
      >
        Optimized ({totalOptimizedTargets})
      </button>
      <button
        class="px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer {!showOptimized ? 'bg-blue-600 text-white' : 'bg-bg-card text-text-secondary hover:text-text-primary'}"
        onclick={() => showOptimized = false}
      >
        All States ({totalStates})
      </button>
    </div>

    {#if showOptimized}
      <!-- ── Optimized View ──────────────────────────────────────── -->
      {#each optimizedManifests as manifest (manifest.bundleId)}
        <section class="mb-10">
          <div class="mb-4 flex items-baseline gap-3">
            <h2 class="text-xl font-semibold">{manifest.bundleName}</h2>
            <span class="text-text-secondary text-sm">
              {manifest.totalSurfacePairs} pairs, {manifest.allTargets.length} targets
              (LP bound: {manifest.treeLPBound})
            </span>
          </div>

          <!-- Phase 1: Leaf Sweep -->
          {#if manifest.phase1Targets.length > 0}
            <h3 class="text-sm font-medium text-green-400 uppercase tracking-wider mb-2">
              Phase 1: Leaf Sweep ({manifest.phase1Targets.length} targets)
            </h3>
            <div class="grid gap-2 mb-4">
              {#each manifest.phase1Targets as target (target.stateId + ':' + (target.targetSurfaceId ?? ''))}
                <a
                  href={targetUrl(manifest.bundleId, target.stateId, target.targetSurfaceId)}
                  class="block rounded-lg bg-bg-card border border-border-subtle p-3 hover:border-green-500 hover:bg-bg-card-hover transition-colors group"
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
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-300">
                        covers {target.coveredPairs.length}
                      </span>
                    </div>
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
            <div class="grid gap-2 mb-4">
              {#each manifest.phase2Targets as target (target.stateId + ':' + (target.targetSurfaceId ?? ''))}
                <a
                  href={targetUrl(manifest.bundleId, target.stateId, target.targetSurfaceId)}
                  class="block rounded-lg bg-bg-card border border-border-subtle p-3 hover:border-amber-500 hover:bg-bg-card-hover transition-colors group"
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
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300">
                        covers {target.coveredPairs.length}
                      </span>
                    </div>
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
          <div class="text-xs text-text-muted mt-2">
            Coverage hash: <code>{manifest.coverageHash}</code>
          </div>
        </section>
      {/each}
    {:else}
      <!-- ── Original All-States View ────────────────────────────── -->
      {#each manifests as manifest (manifest.bundleId)}
        {@const { decision, passThrough } = categorize(manifest.targets)}
        <section class="mb-10">
          <div class="mb-4 flex items-baseline gap-3">
            <h2 class="text-xl font-semibold">{manifest.bundleName}</h2>
            <span class="text-text-secondary text-sm">
              {manifest.totalStates} states, {manifest.targetableStates} targetable
            </span>
          </div>

          <!-- Decision states (where bidding choices happen) -->
          {#if decision.length > 0}
            <h3 class="text-sm font-medium text-text-secondary uppercase tracking-wider mb-2">
              Decision States ({decision.length})
            </h3>
            <div class="grid gap-2 mb-4">
              {#each decision as target (target.stateId)}
                <a
                  href={targetUrl(manifest.bundleId, target.stateId)}
                  class="block rounded-lg bg-bg-card border border-border-subtle p-3 hover:border-blue-500 hover:bg-bg-card-hover transition-colors group"
                >
                  <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                      <div class="font-mono text-sm font-medium text-blue-400 group-hover:text-blue-300 truncate">
                        {target.stateId}
                      </div>
                      <div class="text-xs text-text-secondary mt-1 truncate">
                        {target.pathDescription}
                      </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300">
                        {target.activeSurfaces.length} surfaces
                      </span>
                      {#if target.hasUnresolvableSteps}
                        <span class="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300"
                          title="Path contains predicate or any-bid transitions that can't be statically resolved">
                          partial
                        </span>
                      {/if}
                    </div>
                  </div>
                  {#if target.activeSurfaces.length > 0}
                    <div class="mt-2 flex flex-wrap gap-1">
                      {#each target.activeSurfaces.slice(0, 6) as surface (surface.teachingLabel)}
                        <span class="text-xs px-1.5 py-0.5 rounded bg-bg-deepest text-text-secondary">
                          {surface.teachingLabel}
                        </span>
                      {/each}
                      {#if target.activeSurfaces.length > 6}
                        <span class="text-xs px-1.5 py-0.5 rounded bg-bg-deepest text-text-muted">
                          +{target.activeSurfaces.length - 6} more
                        </span>
                      {/if}
                    </div>
                  {/if}
                </a>
              {/each}
            </div>
          {/if}

          <!-- Pass-through / terminal states -->
          {#if passThrough.length > 0}
            <details class="mb-4">
              <summary class="text-sm font-medium text-text-secondary uppercase tracking-wider mb-2 cursor-pointer hover:text-text-primary">
                Other States ({passThrough.length})
              </summary>
              <div class="grid gap-1 mt-2">
                {#each passThrough as target (target.stateId)}
                  <a
                    href={targetUrl(manifest.bundleId, target.stateId)}
                    class="block rounded-md bg-bg-card/50 border border-border-subtle/50 px-3 py-2 hover:border-blue-500/50 transition-colors text-sm"
                  >
                    <span class="font-mono text-text-secondary">{target.stateId}</span>
                    <span class="text-text-muted ml-2">{target.pathDescription}</span>
                  </a>
                {/each}
              </div>
            </details>
          {/if}

          <!-- Unreachable targets -->
          {#if manifest.unreachableTargets.length > 0}
            <details class="mb-4">
              <summary class="text-sm font-medium text-amber-400 uppercase tracking-wider mb-2 cursor-pointer">
                Unreachable ({manifest.unreachableTargets.length})
              </summary>
              <div class="mt-2 text-sm text-text-muted">
                {#each manifest.unreachableTargets as u (u.stateId)}
                  <div class="font-mono">{u.stateId}: {u.reason}</div>
                {/each}
              </div>
            </details>
          {/if}
        </section>
      {/each}
    {/if}

    {#if manifests.length === 0}
      <p class="text-text-muted text-center py-16">No bundles with FSM machines found.</p>
    {/if}
  </div>
</main>
