<script lang="ts">
  import type { BaseSystemId, CustomSystem } from "../../service";
  import { AVAILABLE_BASE_SYSTEMS, getSystemConfig } from "../../service";
  import { getAppStore, getCustomSystemsStore } from "../../stores/context";
  import SystemDetailView from "./SystemDetailView.svelte";
  import SystemCompareView from "./SystemCompareView.svelte";
  import SystemEditor from "./SystemEditor.svelte";

  const appStore = getAppStore();
  const customSystems = getCustomSystemsStore();

  let viewingPreset = $state<BaseSystemId | null>(null);
  let compareMode = $state(false);
  let editingSystem = $state<CustomSystem | null>(null);
  let creatingFrom = $state<BaseSystemId | null>(null);

  const presetConfig = $derived(viewingPreset ? getSystemConfig(viewingPreset) : null);

  function handleViewPreset(id: BaseSystemId) {
    viewingPreset = viewingPreset === id ? null : id;
    compareMode = false;
  }

  function handleCreateSystem(basedOn: BaseSystemId) {
    creatingFrom = basedOn;
  }

  function handleEditSystem(system: CustomSystem) {
    editingSystem = system;
  }

  function handleDeleteSystem(system: CustomSystem) {
    customSystems.deleteSystem(system.id);
    if (appStore.baseSystemId === system.id) {
      appStore.setBaseSystemId("sayc");
    }
  }

  function handleEditorSave(_system: CustomSystem) {
    editingSystem = null;
    creatingFrom = null;
  }

  function handleEditorCancel() {
    editingSystem = null;
    creatingFrom = null;
  }
</script>

{#if editingSystem || creatingFrom}
  <SystemEditor
    system={editingSystem}
    basedOn={creatingFrom}
    onSave={handleEditorSave}
    onCancel={handleEditorCancel}
  />
{:else}
  <main class="max-w-3xl mx-auto h-full flex flex-col p-6 pb-0" aria-label="Workshop">
    <div class="shrink-0">
      <h1 class="text-3xl font-bold tracking-tight text-text-primary mb-1">Workshop</h1>
      <p class="text-text-secondary mb-6">Manage bidding systems and customize thresholds.</p>
    </div>

    <div class="flex-1 overflow-y-auto pb-6 space-y-8">
      <!-- Preset Systems -->
      <section>
        <h2 class="text-lg font-semibold text-text-primary mb-3">Preset Systems</h2>
        <div class="grid grid-cols-3 gap-3">
          {#each AVAILABLE_BASE_SYSTEMS as sys (sys.id)}
            {@const config = getSystemConfig(sys.id)}
            <button
              class="bg-bg-card border rounded-[--radius-lg] p-4 text-left transition-all cursor-pointer
                {viewingPreset === sys.id
                  ? 'border-accent-primary ring-1 ring-accent-primary'
                  : 'border-border-subtle hover:border-border-prominent'}"
              onclick={() => handleViewPreset(sys.id)}
              data-testid="workshop-preset-{sys.id}"
            >
              <p class="font-semibold text-text-primary text-sm">{sys.shortLabel}</p>
              <p class="text-xs text-text-muted mt-1">{config.ntOpening.minHcp}-{config.ntOpening.maxHcp} NT</p>
              <p class="text-xs text-text-muted">{config.openingRequirements.majorSuitMinLength}-card Majors</p>
            </button>
          {/each}
        </div>

        <!-- Compare toggle -->
        <button
          class="mt-3 px-3 py-1.5 rounded-[--radius-md] text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5
            {compareMode
              ? 'bg-accent-primary text-text-on-accent'
              : 'text-text-muted hover:text-text-primary border border-border-subtle hover:border-border-prominent'}"
          onclick={() => { compareMode = !compareMode; viewingPreset = null; }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/></svg>
          Compare Presets
        </button>

        {#if compareMode}
          <div class="mt-4">
            <SystemCompareView />
          </div>
        {:else if viewingPreset && presetConfig}
          <div class="mt-4">
            <SystemDetailView config={presetConfig} />
          </div>
        {/if}
      </section>

      <!-- My Systems -->
      <section>
        <h2 class="text-lg font-semibold text-text-primary mb-3">My Systems</h2>

        {#if customSystems.systems.length > 0}
          <div class="space-y-2">
            {#each customSystems.systems as system (system.id)}
              {@const basedOnMeta = AVAILABLE_BASE_SYSTEMS.find((s) => s.id === system.basedOn)}
              <div
                class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-4 flex items-center justify-between"
                data-testid="workshop-custom-{system.id}"
              >
                <div>
                  <p class="font-semibold text-text-primary text-sm">{system.name}</p>
                  <p class="text-xs text-text-muted mt-0.5">
                    Based on {basedOnMeta?.shortLabel ?? system.basedOn}
                    &middot; {system.config.ntOpening.minHcp}-{system.config.ntOpening.maxHcp} NT
                    &middot; {system.baseModuleIds.length} base modules
                  </p>
                </div>
                <div class="flex gap-2">
                  <button
                    class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium text-text-muted hover:text-text-primary border border-border-subtle hover:border-border-prominent transition-colors cursor-pointer"
                    onclick={() => handleEditSystem(system)}
                  >Edit</button>
                  <button
                    class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium text-red-400 hover:text-red-300 border border-border-subtle hover:border-red-400/50 transition-colors cursor-pointer"
                    onclick={() => handleDeleteSystem(system)}
                  >Delete</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- New system creation -->
        <div class="bg-bg-card border border-border-subtle border-dashed rounded-[--radius-lg] p-4 mt-2">
          <p class="text-sm font-medium text-text-primary mb-2">New System</p>
          <p class="text-xs text-text-muted mb-3">Start from a preset and customize:</p>
          <div class="flex gap-2">
            {#each AVAILABLE_BASE_SYSTEMS as sys (sys.id)}
              <button
                class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium text-text-muted hover:text-text-primary border border-border-subtle hover:border-accent-primary transition-colors cursor-pointer"
                onclick={() => handleCreateSystem(sys.id)}
                data-testid="workshop-create-from-{sys.id}"
              >
                {sys.shortLabel}
              </button>
            {/each}
          </div>
        </div>
      </section>
    </div>
  </main>
{/if}
