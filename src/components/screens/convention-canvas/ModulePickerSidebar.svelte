<script lang="ts">
  import type { ModuleCatalogEntry } from "../../../service";
  import { filterModules, groupByCategory, mergeModules } from "../../shared/module-catalog";
  import { getUserModuleStore } from "../../../stores/context";

  interface Props {
    systemModules: ModuleCatalogEntry[];
    selectedModuleId: string | null;
    search: string;
    onSelectModule: (moduleId: string) => void;
    onDelete: (moduleId: string) => void;
    onNavigateToEditor: (moduleId: string) => void;
    onSearchChange: (value: string) => void;
  }

  let {
    systemModules,
    selectedModuleId,
    search,
    onSelectModule,
    onDelete,
    onNavigateToEditor,
    onSearchChange,
  }: Props = $props();

  const userModules = getUserModuleStore();

  const userModuleList = $derived(userModules.listModules());
  const systemCatalogModules = $derived(mergeModules(systemModules, []));
  const filteredSystemModules = $derived(filterModules(systemCatalogModules, search));
  const groupedSystemModules = $derived(groupByCategory(filteredSystemModules));

  function getSourceName(forkedFromId: string | null): string | null {
    if (!forkedFromId) return null;
    const source = systemModules.find((m) => m.moduleId === forkedFromId);
    return source?.displayName ?? null;
  }

  function isSelected(moduleId: string): boolean {
    return selectedModuleId === moduleId;
  }
</script>

<aside class="h-full border-r border-border-subtle bg-bg-base flex flex-col overflow-hidden">
  <!-- Search -->
  <div class="shrink-0 p-3">
    <input
      type="text"
      placeholder="Search modules..."
      value={search}
      oninput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
      class="w-full px-3 py-1.5 text-xs bg-bg-card border border-border-subtle rounded-[--radius-md] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary"
    />
  </div>

  <!-- Module list -->
  <div class="flex-1 overflow-y-auto px-3 pb-3">
    <!-- My Conventions -->
    {#if userModuleList.length > 0}
      <div class="mb-4">
        <p class="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">My Conventions</p>
        <div class="space-y-1">
          {#each userModuleList as um (um.metadata.moduleId)}
            {@const sourceName = getSourceName(um.metadata.forkedFrom?.moduleId ?? null)}
            <button
              class="w-full text-left px-2 py-1.5 rounded-[--radius-md] text-xs transition-colors cursor-pointer
                {isSelected(um.metadata.moduleId)
                  ? 'bg-accent-primary/10 text-accent-primary'
                  : 'text-text-secondary hover:bg-bg-surface hover:text-text-primary'}"
              onclick={() => onSelectModule(um.metadata.moduleId)}
            >
              <p class="font-medium truncate">{um.metadata.displayName}</p>
              {#if sourceName}
                <p class="text-[10px] text-text-muted truncate">from {sourceName}</p>
              {/if}
            </button>
            {#if isSelected(um.metadata.moduleId)}
              <div class="flex gap-1 px-2 pb-1">
                <button
                  class="px-2 py-0.5 text-[10px] font-medium rounded text-text-muted hover:text-text-primary border border-border-subtle hover:border-border-prominent transition-colors cursor-pointer"
                  onclick={() => onNavigateToEditor(um.metadata.moduleId)}
                >Edit</button>
                <button
                  class="px-2 py-0.5 text-[10px] font-medium rounded text-red-400 hover:text-red-300 border border-border-subtle hover:border-red-400/50 transition-colors cursor-pointer"
                  onclick={() => onDelete(um.metadata.moduleId)}
                >Delete</button>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {:else}
      <div class="mb-4">
        <p class="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">My Conventions</p>
        <p class="text-[10px] text-text-muted px-2 py-2">No custom conventions yet.</p>
      </div>
    {/if}

    <!-- System Library -->
    <p class="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">System Library</p>
    {#each [...groupedSystemModules] as [category, mods] (category)}
      <div class="mb-3">
        <p class="text-[9px] font-medium text-text-muted px-2 mb-1">{category}</p>
        <div class="space-y-0.5">
          {#each mods as mod (mod.moduleId)}
            <button
              class="w-full text-left px-2 py-1 rounded-[--radius-md] text-xs transition-colors cursor-pointer truncate
                {isSelected(mod.moduleId)
                  ? 'bg-accent-primary/10 text-accent-primary'
                  : 'text-text-secondary hover:bg-bg-surface hover:text-text-primary'}"
              onclick={() => onSelectModule(mod.moduleId)}
            >
              {mod.displayName}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</aside>
