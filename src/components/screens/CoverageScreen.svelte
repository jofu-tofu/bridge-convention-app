<script lang="ts">
  import { getAppStore } from "../../stores/context";
  import { listSystems, getSystem } from "../../conventions/definitions/system-registry";
  import { enumerateRuleAtoms, generateRuleCoverageManifest } from "../../conventions/core/pipeline/rule-enumeration";
  import type { RuleCoverageManifest, RuleAtom } from "../../conventions/core/pipeline/rule-enumeration";
  import type { BiddingSystem } from "../../conventions/definitions/bidding-system";

  const appStore = getAppStore();

  const systems: readonly BiddingSystem[] = listSystems();

  let selectedSystemId = $state<string | null>(appStore.coverageBundle);

  let manifest = $derived.by<RuleCoverageManifest | null>(() => {
    if (!selectedSystemId) return null;
    const system = getSystem(selectedSystemId);
    if (!system?.ruleModules) return null;
    return generateRuleCoverageManifest(system.id, system.ruleModules);
  });

  let showByModule = $state(true);

  function selectSystem(systemId: string) {
    selectedSystemId = systemId;
    appStore.setCoverageBundle(systemId);
  }

  function backToSystems() {
    selectedSystemId = null;
    appStore.setCoverageBundle(null);
  }

  function handleBack() {
    if (selectedSystemId) {
      backToSystems();
    } else {
      appStore.navigateToMenu();
    }
  }

  function coverageUrl(systemId: string): string {
    const base = window.location.origin + window.location.pathname;
    return `${base}?coverage=true&convention=${systemId}`;
  }

  function atomCount(system: BiddingSystem): number {
    if (!system.ruleModules) return 0;
    return enumerateRuleAtoms(system.ruleModules).length;
  }
</script>

<main class="h-full overflow-y-auto bg-bg-deepest text-text-primary">
  <div class="mx-auto max-w-4xl px-6 py-8">
    <!-- Header -->
    <div class="mb-8 flex items-center gap-4">
      <button
        class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
        onclick={handleBack}
        aria-label={selectedSystemId ? "Back to conventions" : "Back to menu"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
      </button>
      <div>
        {#if !selectedSystemId}
          <h1 class="text-2xl font-bold">Coverage</h1>
          <p class="text-text-secondary text-sm mt-1">
            {systems.length} conventions. Choose one to see coverage targets.
          </p>
        {:else if manifest}
          <h1 class="text-2xl font-bold">{manifest.systemId}</h1>
          <p class="text-text-secondary text-sm mt-1">
            {manifest.totalAtoms} atoms &middot;
            {manifest.totalModules} modules
          </p>
        {/if}
      </div>
    </div>

    {#if !selectedSystemId}
      <!-- ── System Picker ─────────────────────────────────────────── -->
      <div class="grid gap-3">
        {#each systems as system (system.id)}
          <button
            class="block w-full text-left rounded-[--radius-lg] bg-bg-card border border-border-subtle p-4 hover:border-blue-500 hover:bg-bg-card-hover transition-colors cursor-pointer group"
            onclick={() => selectSystem(system.id)}
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="text-lg font-semibold text-text-primary group-hover:text-blue-300">
                  {system.name}
                </div>
                <div class="text-sm text-text-secondary mt-1">
                  {system.moduleIds.length} modules &middot;
                  {atomCount(system)} atoms
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

      {#if systems.length === 0}
        <p class="text-text-muted text-center py-16">No convention systems found.</p>
      {/if}

    {:else if manifest}
      <!-- ── Detail: Coverage Atoms ───────────────────────────────── -->

      <!-- View toggle -->
      <div class="mb-6 flex gap-2">
        <button
          class="px-3 py-1.5 rounded-[--radius-md] text-sm transition-colors cursor-pointer {showByModule ? 'bg-blue-600 text-white' : 'bg-bg-card text-text-secondary hover:text-text-primary'}"
          onclick={() => showByModule = true}
        >
          By Module
        </button>
        <button
          class="px-3 py-1.5 rounded-[--radius-md] text-sm transition-colors cursor-pointer {!showByModule ? 'bg-blue-600 text-white' : 'bg-bg-card text-text-secondary hover:text-text-primary'}"
          onclick={() => showByModule = false}
        >
          All Atoms ({manifest.totalAtoms})
        </button>
      </div>

      {#if showByModule}
        {#each [...manifest.atomsByModule.entries()] as [moduleId, atoms] (moduleId)}
          <h3 class="text-sm font-medium text-green-400 uppercase tracking-wider mb-2">
            {moduleId} ({atoms.length} atoms)
          </h3>
          <div class="grid gap-2 mb-6">
            {#each atoms as atom (atom.meaningId)}
              <div
                class="block rounded-[--radius-lg] bg-bg-card border border-border-subtle p-3 group"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="font-mono text-sm font-medium text-green-400 truncate">
                      {atom.moduleId}/{atom.meaningId}
                    </div>
                    <div class="text-xs text-green-300/70 mt-0.5">
                      {atom.meaningLabel}
                    </div>
                    {#if atom.primaryPhaseGuard}
                      <div class="text-xs text-text-secondary mt-1 truncate">
                        phase: {typeof atom.primaryPhaseGuard === 'string' ? atom.primaryPhaseGuard : atom.primaryPhaseGuard.join(', ')}
                        {#if atom.allActivationPaths.length > 1}
                          (+{atom.allActivationPaths.length - 1} paths)
                        {/if}
                      </div>
                    {/if}
                  </div>
                  {#if atom.turnGuard}
                    <span class="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-300 shrink-0">
                      {atom.turnGuard}
                    </span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/each}

        <!-- Shareable link -->
        <div class="text-xs text-text-muted mt-4">
          Shareable: <a href={coverageUrl(manifest.systemId)} class="text-blue-400 hover:underline">
            ?coverage=true&convention={manifest.systemId}
          </a>
        </div>

      {:else}
        <!-- All atoms flat list -->
        <div class="grid gap-2">
          {#each manifest.atoms as atom (atom.moduleId + '/' + atom.meaningId)}
            <div
              class="block rounded-[--radius-md] bg-bg-card/50 border border-border-subtle/50 px-3 py-2 text-sm"
            >
              <span class="font-mono text-text-secondary">{atom.moduleId}/{atom.meaningId}</span>
              <span class="text-green-400 ml-1">{atom.meaningLabel}</span>
            </div>
          {/each}
        </div>
      {/if}

    {:else}
      <p class="text-text-muted text-center py-16">Convention not found.</p>
    {/if}
  </div>
</main>
