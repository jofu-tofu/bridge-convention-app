<script lang="ts">
  import type { ModuleCatalogEntry } from "../../service";
  import { getUserModuleStore } from "../../stores/context";
  import { filterModules, groupByCategory, mergeModules, type CatalogModule } from "../shared/module-catalog";

  interface Props {
    modules: ModuleCatalogEntry[];
    selectedId: string | null;
    onSelect: (id: string) => void;
  }

  let { modules, selectedId, onSelect }: Props = $props();
  let search = $state("");

  const userModules = getUserModuleStore();

  /** All user modules as CatalogModule[], for search filtering. */
  const userCatalogModules: CatalogModule[] = $derived(
    mergeModules([], userModules.listModules()),
  );

  /** System modules as CatalogModule[], for search filtering + grouping. */
  const systemCatalogModules: CatalogModule[] = $derived(
    mergeModules(modules, []),
  );

  /** Apply search filter. */
  const filteredSystemModules = $derived(filterModules(systemCatalogModules, search));
  const filteredUserModules = $derived(filterModules(userCatalogModules, search));

  /** Check if a system module has a user fork (for "customized" badge). */
  function hasUserFork(systemModuleId: string): boolean {
    return userModules.listModules().some(
      (um) => um.metadata.forkedFrom?.moduleId === systemModuleId,
    );
  }

  /** Group system modules by category, preserving order. */
  const groupedSystemModules = $derived(groupByCategory(filteredSystemModules));

  /** Find the source system module name for a user module's forkedFromId. */
  function getSourceName(forkedFromId: string | null): string | null {
    if (!forkedFromId) return null;
    const source = modules.find((m) => m.moduleId === forkedFromId);
    return source?.displayName ?? null;
  }
</script>

<div class="space-y-3">
  <!-- Search -->
  <input
    type="text"
    placeholder="Search conventions..."
    bind:value={search}
    class="w-full px-3 py-2 text-sm bg-bg-card border border-border-subtle rounded-[--radius-md] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary"
  />

  <nav class="space-y-4" aria-label="Conventions">
    <!-- My Conventions section -->
    {#if filteredUserModules.length > 0}
      <div>
        <div class="flex items-center gap-2 px-3 mb-1">
          <p class="text-[10px] font-semibold text-accent-primary uppercase tracking-wider">My Conventions</p>
          <span class="text-[10px] text-text-muted">({filteredUserModules.length})</span>
        </div>
        <div class="space-y-0.5">
          {#each filteredUserModules as mod (mod.moduleId)}
            {@const sourceName = getSourceName(mod.forkedFromId)}
            <button
              class="w-full text-left px-3 py-2 rounded-[--radius-md] text-sm transition-colors cursor-pointer
                {selectedId === mod.moduleId
                  ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/30'
                  : 'text-text-secondary hover:bg-bg-card hover:text-text-primary border border-transparent'}"
              onclick={() => onSelect(mod.moduleId)}
              data-testid="module-sidebar-{mod.moduleId}"
            >
              <span class="font-medium">{mod.displayName}</span>
              {#if sourceName}
                <span class="block text-[10px] text-text-muted mt-0.5">based on {sourceName}</span>
              {/if}
            </button>
          {/each}
        </div>
        <div class="border-b border-border-subtle mt-3"></div>
      </div>
    {/if}

    <!-- System Conventions grouped by category -->
    {#each [...groupedSystemModules] as [category, mods] (category)}
      <div>
        <p class="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-1">{category}</p>
        <div class="space-y-0.5">
          {#each mods as mod (mod.moduleId)}
            <button
              class="w-full text-left px-3 py-2 rounded-[--radius-md] text-sm transition-colors cursor-pointer
                {selectedId === mod.moduleId
                  ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/30'
                  : 'text-text-secondary hover:bg-bg-card hover:text-text-primary border border-transparent'}"
              onclick={() => onSelect(mod.moduleId)}
              data-testid="module-sidebar-{mod.moduleId}"
            >
              <span class="font-medium">{mod.displayName}</span>
              {#if hasUserFork(mod.moduleId)}
                <span class="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-500/15 text-amber-400">customized</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </nav>
</div>
