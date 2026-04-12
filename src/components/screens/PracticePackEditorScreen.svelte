<script lang="ts">
  import { goto } from "$app/navigation";
  import { getAppStore, getPracticePacksStore, getUserModuleStore } from "../../stores/context";
  import { listModules, listConventions } from "../../service/service-helpers";
  import { type CatalogModule, mergeModules } from "../shared/module-catalog";
  import ModuleChecklist from "../shared/ModuleChecklist.svelte";

  const appStore = getAppStore();
  const packsStore = getPracticePacksStore();
  const userModuleStore = getUserModuleStore();

  const packId = appStore.editingPackId;
  const basedOn = appStore.editingPackBasedOn;

  // All available modules (system + user)
  const systemModules = listModules();
  const builtInBundles = listConventions();

  const allConventions: CatalogModule[] = $derived(mergeModules(systemModules, userModuleStore.listModules()));

  // Local editable state
  let editName = $state("");
  let editDescription = $state("");
  let selectedIds = $state<string[]>([]);
  let nameError = $state<string | null>(null);

  // Initialize state based on mode
  function initState() {
    if (packId) {
      // Edit mode
      const pack = packsStore.getPack(packId);
      if (pack) {
        editName = pack.name;
        editDescription = pack.description;
        selectedIds = [...pack.conventionIds];
      }
    } else if (basedOn) {
      // Fork mode
      const sourceBundle = builtInBundles.find((b) => b.id === basedOn);
      if (sourceBundle) {
        editName = `My ${sourceBundle.name}`;
        editDescription = "";
        selectedIds = sourceBundle.moduleIds ? [...sourceBundle.moduleIds] : [];
      }
    }
    // Blank mode: defaults are fine
  }

  initState();

  const isSelected = $derived(new Set(selectedIds));

  function toggleConvention(id: string): void {
    if (isSelected.has(id)) {
      selectedIds = selectedIds.filter((sid) => sid !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
  }

  function removeConvention(id: string): void {
    selectedIds = selectedIds.filter((sid) => sid !== id);
  }

  function moveUp(index: number): void {
    if (index <= 0) return;
    const next = [...selectedIds];
    const temp = next[index]!;
    next[index] = next[index - 1]!;
    next[index - 1] = temp;
    selectedIds = next;
  }

  function moveDown(index: number): void {
    if (index >= selectedIds.length - 1) return;
    const next = [...selectedIds];
    const temp = next[index]!;
    next[index] = next[index + 1]!;
    next[index + 1] = temp;
    selectedIds = next;
  }

  function getConventionName(id: string): string {
    const conv = allConventions.find((c) => c.moduleId === id);
    return conv?.displayName ?? id;
  }

  function isCustomConvention(id: string): boolean {
    return allConventions.find((c) => c.moduleId === id)?.isCustom ?? false;
  }

  function handleSave(): void {
    const trimmed = editName.trim();
    const validationError = packsStore.validateName(trimmed, packId ?? undefined);
    if (validationError) {
      nameError = validationError;
      return;
    }

    if (packId) {
      packsStore.updatePack(packId, {
        name: trimmed,
        description: editDescription.trim(),
        conventionIds: selectedIds,
      });
    } else {
      packsStore.createPack({
        name: trimmed,
        description: editDescription.trim(),
        conventionIds: selectedIds,
        basedOn: basedOn,
      });
    }

    void goto("/workshop");
  }

  function handleCancel(): void {
    void goto("/workshop");
  }

  function handleDelete(): void {
    if (!packId) return;
    packsStore.deletePack(packId);
    void goto("/workshop");
  }
</script>

<main class="max-w-3xl mx-auto h-full flex flex-col p-6 pb-0" aria-label="Practice Pack Editor">
  <div class="shrink-0">
    <!-- Header with name + actions -->
    <div class="flex items-start gap-3 mb-4">
      <div class="flex-1">
        <label for="pack-name" class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1 block">Practice Pack Name</label>
        <input
          id="pack-name"
          type="text"
          bind:value={editName}
          oninput={() => { nameError = null; }}
          class="w-full px-3 py-2 text-lg font-semibold bg-bg-card border rounded-[--radius-md] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary
            {nameError ? 'border-red-400' : 'border-border-subtle'}"
          placeholder="Practice pack name"
        />
        {#if nameError}
          <p class="text-xs text-red-400 mt-1">{nameError}</p>
        {/if}
      </div>
      <div class="flex gap-2 pt-6">
        <button
          class="px-4 py-2 rounded-[--radius-md] text-sm font-medium bg-accent-primary text-text-on-accent hover:bg-accent-primary/90 transition-colors cursor-pointer"
          onclick={handleSave}
        >
          Save
        </button>
        <button
          class="px-4 py-2 rounded-[--radius-md] text-sm font-medium text-text-muted hover:text-text-primary border border-border-subtle hover:border-border-prominent transition-colors cursor-pointer"
          onclick={handleCancel}
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Description -->
    <div class="mb-6">
      <label for="pack-description" class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1 block">Description</label>
      <textarea
        id="pack-description"
        bind:value={editDescription}
        class="w-full px-3 py-2 text-sm bg-bg-card border border-border-subtle rounded-[--radius-md] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary resize-none"
        rows="2"
        placeholder="Optional description for this practice pack"
      ></textarea>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto pb-6 space-y-6">
    <!-- Selected conventions (ordered list) -->
    <section>
      <h2 class="text-sm font-semibold text-text-primary mb-3">
        Conventions in this pack
        <span class="text-text-muted font-normal">({selectedIds.length})</span>
      </h2>

      {#if selectedIds.length === 0}
        <div class="bg-bg-card border border-border-subtle border-dashed rounded-[--radius-lg] p-4">
          <p class="text-sm text-text-muted text-center">No conventions selected. Add some from the list below.</p>
        </div>
      {:else}
        <div class="space-y-1">
          {#each selectedIds as id, i (id)}
            <div class="bg-bg-card border border-border-subtle rounded-[--radius-md] px-3 py-2 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-xs text-text-muted w-5 text-right shrink-0">{i + 1}.</span>
                <span class="text-sm text-text-primary truncate">{getConventionName(id)}</span>
                {#if isCustomConvention(id)}
                  <span class="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-accent-primary/15 text-accent-primary shrink-0">yours</span>
                {/if}
              </div>
              <div class="flex gap-1 shrink-0">
                <button
                  class="p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  onclick={() => moveUp(i)}
                  disabled={i === 0}
                  aria-label="Move up"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>
                </button>
                <button
                  class="p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  onclick={() => moveDown(i)}
                  disabled={i === selectedIds.length - 1}
                  aria-label="Move down"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                </button>
                <button
                  class="p-1 text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                  onclick={() => removeConvention(id)}
                  aria-label="Remove"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- Available conventions (grouped checklist) -->
    <section>
      <h2 class="text-sm font-semibold text-text-primary mb-3">Available Conventions</h2>
      <div class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-4">
        <ModuleChecklist
          modules={allConventions}
          isSelected={(id) => isSelected.has(id)}
          onToggle={toggleConvention}
        />
      </div>
    </section>

    <!-- Delete (edit mode only) -->
    {#if packId}
      <section class="pt-4 border-t border-border-subtle">
        <button
          class="px-4 py-2 rounded-[--radius-md] text-sm font-medium text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/50 transition-colors cursor-pointer"
          onclick={handleDelete}
        >
          Delete Practice Pack
        </button>
      </section>
    {/if}
  </div>
</main>
