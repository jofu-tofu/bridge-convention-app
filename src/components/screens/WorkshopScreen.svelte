<script lang="ts">
  import type { BaseSystemId, CustomSystem, ConventionInfo } from "../../service";
  import { AVAILABLE_BASE_SYSTEMS } from "../../service";
  import { getAppStore, getCustomSystemsStore, getPracticePacksStore } from "../../stores/context";
  import { listConventions } from "../../service/service-helpers";
  import ToggleGroup from "../shared/ToggleGroup.svelte";
  import ItemCard from "../shared/ItemCard.svelte";
  import ScreenSection from "../shared/ScreenSection.svelte";
  import SystemEditor from "./SystemEditor.svelte";
  import CreationPickerDialog from "../shared/CreationPickerDialog.svelte";
  import { buildSystemPickerCategories, buildConventionPickerCategories, buildPracticePackPickerCategories } from "../shared/creation-picker";
  import type { ModuleCatalogEntry, ModuleCategory } from "../../service";
  import { listModules } from "../../service";
  import type { UserModule } from "../../service/session-types";
  import { getService, getUserModuleStore } from "../../stores/context";
  import { MODULE_CATEGORIES } from "../shared/module-catalog";

  const appStore = getAppStore();
  const customSystems = getCustomSystemsStore();
  const practicePacksStore = getPracticePacksStore();

  let activeSection = $state<"systems" | "conventions" | "practice-packs">("systems");
  let editingSystem = $state<CustomSystem | null>(null);
  let creatingFrom = $state<BaseSystemId | null>(null);

  // Convention management state
  const systemModules: ModuleCatalogEntry[] = listModules();
  const userModules = getUserModuleStore();
  const service = getService();

  const builtInBundles: ConventionInfo[] = listConventions();

  // Picker dialog refs
  let systemPickerRef = $state<{ open: () => void; close: () => void }>();
  let conventionPickerRef = $state<{ open: () => void; close: () => void }>();
  let packPickerRef = $state<{ open: () => void; close: () => void }>();

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

  let forkingModuleId = $state<string | null>(null);

  async function handleFork(moduleId: string) {
    if (forkingModuleId) return;
    forkingModuleId = moduleId;
    try {
      const content = await service.forkModule(moduleId);
      const contentObj = content as Record<string, unknown>;
      const forkedModuleId = contentObj.moduleId as string;
      if (!forkedModuleId) return;
      const now = new Date().toISOString();
      const userModule: UserModule = {
        metadata: {
          moduleId: forkedModuleId,
          displayName: contentObj.displayName as string,
          category: (contentObj.category as ModuleCategory) ?? "custom",
          forkedFrom: {
            moduleId: moduleId,
            fixtureVersion: (contentObj.fixtureVersion as number) ?? 1,
          },
          createdAt: now,
          updatedAt: now,
        },
        content,
      };
      userModules.saveModule(userModule);
      appStore.navigateToConventionEditor(forkedModuleId, true);
    } finally {
      forkingModuleId = null;
    }
  }

  function getSourceDisplayName(forkedFromId: string | null): string | null {
    if (!forkedFromId) return null;
    const source = systemModules.find((m) => m.moduleId === forkedFromId);
    return source?.displayName ?? null;
  }

  function getCategoryDisplayName(um: UserModule): string {
    const sourceId = um.metadata.forkedFrom?.moduleId ?? null;
    if (sourceId) return MODULE_CATEGORIES[sourceId] ?? "Other";
    return um.metadata.category ?? "Custom";
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
  <main class="max-w-5xl mx-auto h-full flex flex-col p-6 pb-0" aria-label="Workshop">
    <div class="shrink-0">
      <h1 class="text-3xl font-bold tracking-tight text-text-primary mb-1">Workshop</h1>
      <p class="text-text-secondary mb-5">Manage bidding systems, conventions, and practice packs.</p>
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
      <ScreenSection title="My Systems">
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-[--radius-md] text-sm font-medium bg-accent-primary text-text-on-accent hover:bg-accent-primary/90 transition-colors cursor-pointer mb-3"
          onclick={() => { systemPickerRef?.open(); }}
          data-testid="workshop-new-system-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          New System
        </button>

        {#if customSystems.systems.length > 0}
          <div class="space-y-2">
            {#each customSystems.systems as system (system.id)}
              {@const basedOnMeta = AVAILABLE_BASE_SYSTEMS.find((s) => s.id === system.basedOn)}
              <ItemCard testId="workshop-custom-{system.id}" interactive={false}>
                <div class="flex items-center justify-between">
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
              </ItemCard>
            {/each}
          </div>
        {:else}
          <p class="text-sm text-text-muted py-4">No custom systems yet. Create one to customize strength thresholds and module selection.</p>
        {/if}
      </ScreenSection>
    </div>

    {:else if activeSection === "conventions"}
    <div class="flex-1 overflow-y-auto pb-6 space-y-8">
      <ScreenSection title="My Conventions">
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-[--radius-md] text-sm font-medium bg-accent-primary text-text-on-accent hover:bg-accent-primary/90 transition-colors cursor-pointer mb-3"
          onclick={() => { conventionPickerRef?.open(); }}
          data-testid="workshop-new-convention-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          New Convention
        </button>

        {#if userModules.listModules().length > 0}
          <div class="space-y-2">
            {#each userModules.listModules() as um (um.metadata.moduleId)}
              {@const sourceName = getSourceDisplayName(um.metadata.forkedFrom?.moduleId ?? null)}
              {@const categoryName = getCategoryDisplayName(um)}
              <ItemCard
                onclick={() => appStore.navigateToConventionEditor(um.metadata.moduleId)}
                testId="workshop-convention-{um.metadata.moduleId}"
              >
                <div class="flex items-center justify-between">
                  <div class="min-w-0">
                    <p class="font-semibold text-text-primary text-sm">{um.metadata.displayName}</p>
                    <p class="text-xs text-text-muted mt-0.5">
                      {categoryName}
                      {#if sourceName}
                        &middot; from {sourceName}
                      {/if}
                    </p>
                  </div>
                  <div class="flex gap-2 shrink-0">
                    <button
                      class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium text-text-muted hover:text-text-primary border border-border-subtle hover:border-border-prominent transition-colors cursor-pointer"
                      onclick={(e) => { e.stopPropagation(); appStore.navigateToConventionEditor(um.metadata.moduleId); }}
                    >Edit</button>
                    <button
                      class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium text-red-400 hover:text-red-300 border border-border-subtle hover:border-red-400/50 transition-colors cursor-pointer"
                      onclick={(e) => { e.stopPropagation(); userModules.deleteModule(um.metadata.moduleId); }}
                    >Delete</button>
                  </div>
                </div>
              </ItemCard>
            {/each}
          </div>
        {:else}
          <p class="text-sm text-text-muted py-4">No custom conventions yet.</p>
        {/if}
      </ScreenSection>
    </div>

    {:else if activeSection === "practice-packs"}
    <div class="flex-1 overflow-y-auto pb-6 space-y-8">
      <ScreenSection title="My Practice Packs">
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-[--radius-md] text-sm font-medium bg-accent-primary text-text-on-accent hover:bg-accent-primary/90 transition-colors cursor-pointer mb-3"
          onclick={() => { packPickerRef?.open(); }}
          data-testid="workshop-new-pack-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          New Practice Pack
        </button>

        {#if practicePacksStore.packs.length > 0}
          <div class="space-y-2">
            {#each practicePacksStore.packs as pack (pack.id)}
              {@const basedOnBundle = pack.basedOn ? builtInBundles.find((b) => b.id === pack.basedOn) : null}
              <ItemCard testId="workshop-pack-{pack.id}" interactive={false}>
                <div class="flex items-center justify-between">
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
              </ItemCard>
            {/each}
          </div>
        {:else}
          <p class="text-sm text-text-muted py-4">No practice packs yet.</p>
        {/if}
      </ScreenSection>
    </div>
    {/if}
  </main>
{/if}

<!-- Picker dialogs -->
<CreationPickerDialog
  bind:this={systemPickerRef}
  title="New System"
  categories={buildSystemPickerCategories()}
  scratchLabel="Start from scratch"
  onSelect={(id) => handleCreateSystem(id as BaseSystemId)}
  onScratch={() => handleCreateSystem("sayc")}
/>

<CreationPickerDialog
  bind:this={conventionPickerRef}
  title="New Convention"
  categories={buildConventionPickerCategories(systemModules)}
  scratchLabel="Start from scratch"
  scratchDisabled={true}
  searchable={true}
  searchPlaceholder="Search conventions..."
  wide={true}
  onSelect={(moduleId) => handleFork(moduleId)}
/>

<CreationPickerDialog
  bind:this={packPickerRef}
  title="New Practice Pack"
  categories={buildPracticePackPickerCategories(builtInBundles)}
  scratchLabel="Start from scratch"
  onSelect={(bundleId) => appStore.navigateToPackEditor(null, bundleId)}
  onScratch={() => appStore.navigateToPackEditor(null)}
/>
