<script lang="ts">
  import { getAppStore } from "../../stores/context";
  import { listConventionSpecs, getConventionSpec } from "../../conventions/spec-registry";
  import { generateProtocolCoverageManifest } from "../../conventions/core/protocol/coverage-enumeration";
  import type { ProtocolCoverageManifest, ProtocolCoverageAtom } from "../../conventions/core/protocol/coverage-enumeration";
  import type { ConventionSpec } from "../../conventions/core/protocol/types";
  import { getBaseModules } from "../../conventions/core/protocol/types";

  const appStore = getAppStore();

  const specs: ConventionSpec[] = listConventionSpecs();

  let selectedSpecId = $state<string | null>(appStore.coverageBundle);

  let manifest = $derived.by<ProtocolCoverageManifest | null>(() => {
    if (!selectedSpecId) return null;
    const spec = getConventionSpec(selectedSpecId);
    if (!spec) return null;
    return generateProtocolCoverageManifest(spec);
  });

  let showByTrack = $state(true);

  function selectSpec(specId: string) {
    selectedSpecId = specId;
    appStore.setCoverageBundle(specId);
  }

  function backToSpecs() {
    selectedSpecId = null;
    appStore.setCoverageBundle(null);
  }

  function handleBack() {
    if (selectedSpecId) {
      backToSpecs();
    } else {
      appStore.navigateToMenu();
    }
  }

  function targetUrl(specId: string, stateId: string, surfaceId?: string): string {
    const base = window.location.origin + window.location.pathname;
    let url = `${base}?convention=${specId}&targetState=${encodeURIComponent(stateId)}`;
    if (surfaceId) {
      url += `&targetSurface=${encodeURIComponent(surfaceId)}`;
    }
    return url;
  }

  function coverageUrl(specId: string): string {
    const base = window.location.origin + window.location.pathname;
    return `${base}?coverage=true&convention=${specId}`;
  }

  function specStateCount(spec: ConventionSpec): number {
    return getBaseModules(spec).reduce(
      (sum, m) => sum + Object.keys(m.states).length, 0,
    );
  }
</script>

<main class="h-full overflow-y-auto bg-bg-deepest text-text-primary">
  <div class="mx-auto max-w-4xl px-6 py-8">
    <!-- Header -->
    <div class="mb-8 flex items-center gap-4">
      <button
        class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
        onclick={handleBack}
        aria-label={selectedSpecId ? "Back to conventions" : "Back to menu"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
      </button>
      <div>
        {#if !selectedSpecId}
          <h1 class="text-2xl font-bold">Coverage</h1>
          <p class="text-text-secondary text-sm mt-1">
            {specs.length} conventions. Choose one to see coverage targets.
          </p>
        {:else if manifest}
          <h1 class="text-2xl font-bold">{manifest.specName}</h1>
          <p class="text-text-secondary text-sm mt-1">
            {manifest.totalAtoms} atoms &middot;
            {manifest.totalBaseStates} base states &middot;
            {manifest.totalProtocolStates} protocol states
          </p>
        {/if}
      </div>
    </div>

    {#if !selectedSpecId}
      <!-- ── Spec Picker ─────────────────────────────────────────── -->
      <div class="grid gap-3">
        {#each specs as spec (spec.id)}
          <button
            class="block w-full text-left rounded-[--radius-lg] bg-bg-card border border-border-subtle p-4 hover:border-blue-500 hover:bg-bg-card-hover transition-colors cursor-pointer group"
            onclick={() => selectSpec(spec.id)}
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="text-lg font-semibold text-text-primary group-hover:text-blue-300">
                  {spec.name}
                </div>
                <div class="text-sm text-text-secondary mt-1">
                  {getBaseModules(spec).length} base modules &middot;
                  {specStateCount(spec)} states
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

      {#if specs.length === 0}
        <p class="text-text-muted text-center py-16">No convention specs found.</p>
      {/if}

    {:else if manifest}
      <!-- ── Detail: Coverage Atoms ───────────────────────────────── -->

      <!-- View toggle -->
      <div class="mb-6 flex gap-2">
        <button
          class="px-3 py-1.5 rounded-[--radius-md] text-sm transition-colors cursor-pointer {showByTrack ? 'bg-blue-600 text-white' : 'bg-bg-card text-text-secondary hover:text-text-primary'}"
          onclick={() => showByTrack = true}
        >
          By Track ({manifest.baseAtoms.length} base + {manifest.protocolAtoms.length} protocol)
        </button>
        <button
          class="px-3 py-1.5 rounded-[--radius-md] text-sm transition-colors cursor-pointer {!showByTrack ? 'bg-blue-600 text-white' : 'bg-bg-card text-text-secondary hover:text-text-primary'}"
          onclick={() => showByTrack = false}
        >
          All Atoms ({manifest.totalAtoms})
        </button>
      </div>

      {#if showByTrack}
        <!-- Base Atoms -->
        {#if manifest.baseAtoms.length > 0}
          <h3 class="text-sm font-medium text-green-400 uppercase tracking-wider mb-2">
            Base Track ({manifest.baseAtoms.length} atoms)
          </h3>
          <div class="grid gap-2 mb-6">
            {#each manifest.baseAtoms as atom (atom.baseStateId + ':' + atom.meaningId)}
              <a
                href={targetUrl(manifest.specId, atom.baseStateId, atom.meaningId)}
                class="block rounded-[--radius-lg] bg-bg-card border border-border-subtle p-3 hover:border-green-500 hover:bg-bg-card-hover transition-colors group"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="font-mono text-sm font-medium text-green-400 group-hover:text-green-300 truncate">
                      {atom.baseStateId}
                    </div>
                    <div class="text-xs text-green-300/70 mt-0.5">
                      {atom.meaningLabel}
                    </div>
                    <div class="text-xs text-text-secondary mt-1 truncate">
                      {atom.surfaceId}
                    </div>
                  </div>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-300 shrink-0">
                    base
                  </span>
                </div>
              </a>
            {/each}
          </div>
        {/if}

        <!-- Protocol Atoms -->
        {#if manifest.protocolAtoms.length > 0}
          <h3 class="text-sm font-medium text-amber-400 uppercase tracking-wider mb-2">
            Protocol ({manifest.protocolAtoms.length} atoms)
          </h3>
          <div class="grid gap-2 mb-6">
            {#each manifest.protocolAtoms as atom (atom.baseStateId + ':' + atom.meaningId + ':' + (atom.activeProtocols[0]?.protocolId ?? ''))}
              <a
                href={targetUrl(manifest.specId, atom.baseStateId, atom.meaningId)}
                class="block rounded-[--radius-lg] bg-bg-card border border-border-subtle p-3 hover:border-amber-500 hover:bg-bg-card-hover transition-colors group"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="font-mono text-sm font-medium text-amber-400 group-hover:text-amber-300 truncate">
                      {atom.baseStateId}
                    </div>
                    <div class="text-xs text-amber-300/70 mt-0.5">
                      {atom.meaningLabel}
                    </div>
                    {#if atom.activeProtocols[0]}
                      <div class="text-xs text-text-secondary mt-1 truncate">
                        Protocol: {atom.activeProtocols[0].protocolId} @ {atom.activeProtocols[0].stateId}
                      </div>
                    {/if}
                  </div>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 shrink-0">
                    protocol
                  </span>
                </div>
              </a>
            {/each}
          </div>
        {/if}

        <!-- Unreachable -->
        {#if manifest.unreachable.length > 0}
          <details class="mb-4">
            <summary class="text-sm font-medium text-red-400 uppercase tracking-wider mb-2 cursor-pointer">
              Unreachable ({manifest.unreachable.length})
            </summary>
            <div class="mt-2 text-sm text-text-muted">
              {#each manifest.unreachable as entry (entry.stateId)}
                <div class="font-mono">{entry.stateId}: {entry.reason}</div>
              {/each}
            </div>
          </details>
        {/if}

        <!-- Shareable link -->
        <div class="text-xs text-text-muted mt-4">
          Shareable: <a href={coverageUrl(manifest.specId)} class="text-blue-400 hover:underline">
            ?coverage=true&convention={manifest.specId}
          </a>
        </div>

      {:else}
        <!-- All atoms flat list -->
        <div class="grid gap-2">
          {#each [...manifest.baseAtoms, ...manifest.protocolAtoms] as atom (atom.baseStateId + ':' + atom.meaningId + ':' + (atom.activeProtocols[0]?.protocolId ?? ''))}
            <a
              href={targetUrl(manifest.specId, atom.baseStateId, atom.meaningId)}
              class="block rounded-[--radius-md] bg-bg-card/50 border border-border-subtle/50 px-3 py-2 hover:border-blue-500/50 transition-colors text-sm"
            >
              <span class="font-mono text-text-secondary">{atom.baseStateId}</span>
              <span class="{atom.involvesProtocol ? 'text-amber-400' : 'text-green-400'} ml-1">{atom.meaningLabel}</span>
              {#if atom.involvesProtocol && atom.activeProtocols[0]}
                <span class="text-text-muted ml-2">({atom.activeProtocols[0].protocolId})</span>
              {/if}
            </a>
          {/each}
        </div>
      {/if}

    {:else}
      <p class="text-text-muted text-center py-16">Convention not found.</p>
    {/if}
  </div>
</main>
