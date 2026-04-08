<script lang="ts">
  import type { BaseSystemId, CustomSystem, ConventionInfo } from "../../service";
  import { AVAILABLE_BASE_SYSTEMS, getSystemConfig } from "../../service";
  import { getAppStore, getCustomSystemsStore, getPracticePacksStore } from "../../stores/context";
  import { listConventions } from "../../service/service-helpers";
  import ToggleGroup from "../shared/ToggleGroup.svelte";
  import SystemDetailView from "./SystemDetailView.svelte";
  import SystemCompareView from "./SystemCompareView.svelte";
  import SystemEditor from "./SystemEditor.svelte";
  import ConventionsSection from "./ConventionsSection.svelte";

  const appStore = getAppStore();
  const customSystems = getCustomSystemsStore();
  const practicePacksStore = getPracticePacksStore();

  let activeSection = $state<"systems" | "conventions" | "practice-packs">("systems");
  let viewingPreset = $state<BaseSystemId | null>(null);
  let compareMode = $state(false);
  let editingSystem = $state<CustomSystem | null>(null);
  let creatingFrom = $state<BaseSystemId | null>(null);
  let forkFromBundle = $state("");
  let showNewSystemMenu = $state(false);

  const presetConfig = $derived(viewingPreset ? getSystemConfig(viewingPreset) : null);
  const builtInBundles: ConventionInfo[] = listConventions();

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
    onNavigateConventions={() => { editingSystem = null; creatingFrom = null; activeSection = "conventions"; }}
  />
{:else}
  <main class="max-w-3xl mx-auto h-full flex flex-col p-6 pb-0" aria-label="Workshop">
    <div class="shrink-0">
      <h1 class="text-3xl font-bold tracking-tight text-text-primary mb-1">Workshop</h1>
      <p class="text-text-secondary mb-4">Manage bidding systems, conventions, and practice packs.</p>
      <div class="mb-4">
        <ToggleGroup
          items={[
            { id: "systems", label: "Systems" },
            { id: "conventions", label: "Conventions" },
            { id: "practice-packs", label: "Practice Packs" },
          ]}
          active={activeSection}
          onSelect={(id) => { activeSection = id as typeof activeSection; }}
          ariaLabel="Workshop section"
        />
      </div>
    </div>

    {#if activeSection === "systems"}
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

        <!-- New system button with slide-out options -->
        <div class="flex items-center gap-2 mb-3">
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-[--radius-md] text-sm font-medium bg-accent-primary text-text-on-accent hover:bg-accent-primary/90 transition-colors cursor-pointer"
            onclick={() => { showNewSystemMenu = !showNewSystemMenu; }}
            data-testid="workshop-new-system-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
              class="transition-transform duration-200 {showNewSystemMenu ? 'rotate-45' : ''}"
            ><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            New System
          </button>

          {#if showNewSystemMenu}
            <!-- Backdrop to close menu -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="fixed inset-0 z-10" onclick={() => { showNewSystemMenu = false; }} onkeydown={() => {}}></div>
            <div class="flex items-center gap-1.5 z-20 animate-slide-in">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" class="text-border-subtle shrink-0" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
              {#each AVAILABLE_BASE_SYSTEMS as sys (sys.id)}
                <button
                  class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium bg-bg-card border border-border-subtle hover:border-accent-primary hover:text-accent-primary text-text-primary transition-all cursor-pointer whitespace-nowrap"
                  onclick={() => { showNewSystemMenu = false; handleCreateSystem(sys.id); }}
                  data-testid="workshop-create-from-{sys.id}"
                >
                  {sys.shortLabel}
                </button>
              {/each}
              <span class="text-border-subtle mx-0.5">|</span>
              <button
                class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium text-text-muted hover:text-accent-primary border border-dashed border-border-subtle hover:border-accent-primary transition-all cursor-pointer whitespace-nowrap"
                onclick={() => { showNewSystemMenu = false; handleCreateSystem("sayc"); }}
                data-testid="workshop-create-blank"
              >
                Start from scratch
              </button>
            </div>
          {/if}
        </div>

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
      </section>
    </div>
    {:else if activeSection === "conventions"}
    <div class="flex-1 min-h-0">
      <ConventionsSection />
    </div>
    {:else if activeSection === "practice-packs"}
    <div class="flex-1 overflow-y-auto pb-6 space-y-8">
      <!-- My Practice Packs -->
      <section>
        <h2 class="text-lg font-semibold text-text-primary mb-3">My Practice Packs</h2>

        {#if practicePacksStore.packs.length > 0}
          <div class="space-y-2">
            {#each practicePacksStore.packs as pack (pack.id)}
              {@const basedOnBundle = pack.basedOn ? builtInBundles.find((b) => b.id === pack.basedOn) : null}
              <div
                class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-4 flex items-center justify-between"
                data-testid="workshop-pack-{pack.id}"
              >
                <div>
                  <p class="font-semibold text-text-primary text-sm">{pack.name}</p>
                  <p class="text-xs text-text-muted mt-0.5">
                    {pack.conventionIds.length} convention{pack.conventionIds.length !== 1 ? "s" : ""}
                    {#if basedOnBundle}
                      &middot; Based on {basedOnBundle.name}
                    {/if}
                  </p>
                  {#if pack.description}
                    <p class="text-xs text-text-secondary mt-1">{pack.description}</p>
                  {/if}
                </div>
                <div class="flex gap-2">
                  <button
                    class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium text-text-muted hover:text-text-primary border border-border-subtle hover:border-border-prominent transition-colors cursor-pointer"
                    onclick={() => appStore.navigateToPackEditor(pack.id)}
                  >Edit</button>
                  <button
                    class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium text-red-400 hover:text-red-300 border border-border-subtle hover:border-red-400/50 transition-colors cursor-pointer"
                    onclick={() => practicePacksStore.deletePack(pack.id)}
                  >Delete</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- New practice pack creation -->
        <div class="bg-bg-card border border-border-subtle border-dashed rounded-[--radius-lg] p-4 mt-2">
          <p class="text-sm font-medium text-text-primary mb-2">New Practice Pack</p>
          <p class="text-xs text-text-muted mb-3">Create a blank pack or start from an existing one:</p>
          <div class="flex flex-wrap items-center gap-2">
            <button
              class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium bg-accent-primary text-text-on-accent hover:bg-accent-primary/90 transition-colors cursor-pointer"
              onclick={() => appStore.navigateToPackEditor(null)}
            >
              Blank
            </button>
            <span class="text-xs text-text-muted">or start from:</span>
            <select
              class="bg-bg-base border border-border-subtle rounded-[--radius-md] px-3 py-1.5 text-xs text-text-primary cursor-pointer"
              bind:value={forkFromBundle}
              data-testid="workshop-fork-bundle-select"
            >
              <option value="">Choose a practice pack...</option>
              {#each builtInBundles as bundle (bundle.id)}
                <option value={bundle.id}>{bundle.name}</option>
              {/each}
            </select>
            <button
              class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium text-text-muted hover:text-text-primary border border-border-subtle hover:border-accent-primary transition-colors cursor-pointer
                {!forkFromBundle ? 'opacity-50 cursor-not-allowed' : ''}"
              disabled={!forkFromBundle}
              onclick={() => { if (forkFromBundle) appStore.navigateToPackEditor(null, forkFromBundle); }}
              data-testid="workshop-fork-bundle-button"
            >
              Copy
            </button>
          </div>
        </div>
      </section>

      <!-- Built-in practice packs -->
      <section>
        <h2 class="text-lg font-semibold text-text-primary mb-3">Built-in Packs</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {#each builtInBundles as bundle (bundle.id)}
            {@const moduleCount = bundle.moduleDescriptions?.size ?? 0}
            <div
              class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-4 flex flex-col justify-between"
              data-testid="workshop-builtin-{bundle.id}"
            >
              <div>
                <p class="font-semibold text-text-primary text-sm">{bundle.name}</p>
                <p class="text-xs text-text-muted mt-1">
                  {moduleCount} convention{moduleCount !== 1 ? "s" : ""}
                </p>
                {#if bundle.description}
                  <p class="text-xs text-text-secondary mt-1 line-clamp-2">{bundle.description}</p>
                {/if}
              </div>
              <button
                class="mt-3 px-3 py-1.5 rounded-[--radius-md] text-xs font-medium text-text-muted hover:text-text-primary border border-border-subtle hover:border-accent-primary transition-colors cursor-pointer self-start"
                onclick={() => appStore.navigateToPackEditor(null, bundle.id)}
              >
                Copy &amp; Customize
              </button>
            </div>
          {/each}
        </div>
      </section>
    </div>
    {/if}
  </main>
{/if}
