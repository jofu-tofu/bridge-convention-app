<script lang="ts">
  import { SvelteMap } from "svelte/reactivity";
  import type { ModuleCatalogEntry } from "../../service";
  import { getUserModuleStore } from "../../stores/context";
  import ToggleGroup from "../shared/ToggleGroup.svelte";

  interface SidebarModule {
    moduleId: string;
    displayName: string;
    isCustom: boolean;
    forkedFromId: string | null;
  }

  interface Props {
    modules: ModuleCatalogEntry[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    filter?: "all" | "system" | "custom";
    onFilterChange?: (filter: "all" | "system" | "custom") => void;
  }

  let { modules, selectedId, onSelect, filter = "all", onFilterChange }: Props = $props();
  let search = $state("");

  const userModules = getUserModuleStore();

  const MODULE_CATEGORIES: Record<string, string> = {
    "natural-bids": "Opening Bids",
    "strong-2c": "Opening Bids",
    "stayman": "Notrump Responses",
    "stayman-garbage": "Notrump Responses",
    "jacoby-transfers": "Notrump Responses",
    "jacoby-4way": "Notrump Responses",
    "smolen": "Notrump Responses",
    "bergen": "Major Raises",
    "weak-twos": "Weak Bids",
    "dont": "Competitive",
    "michaels-unusual": "Competitive",
    "blackwood": "Slam",
  };

  const UNCATEGORIZED = "Other";

  /** Merge system modules + user modules into a unified list. */
  const allSidebarModules = $derived.by(() => {
    const result: SidebarModule[] = [];

    // System modules
    for (const mod of modules) {
      result.push({
        moduleId: mod.moduleId,
        displayName: mod.displayName,
        isCustom: false,
        forkedFromId: null,
      });
    }

    // User modules
    for (const um of userModules.listModules()) {
      result.push({
        moduleId: um.metadata.moduleId,
        displayName: um.metadata.displayName,
        isCustom: true,
        forkedFromId: um.metadata.forkedFrom?.moduleId ?? null,
      });
    }

    return result;
  });

  const filteredModules = $derived.by(() => {
    let filtered = allSidebarModules;

    // Apply filter
    if (filter === "system") {
      filtered = filtered.filter((m) => !m.isCustom);
    } else if (filter === "custom") {
      filtered = filtered.filter((m) => m.isCustom);
    }

    // Apply search
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((m) => m.displayName.toLowerCase().includes(q));
    }

    return filtered;
  });

  /** Check if a system module has a user fork (for "modified" badge). */
  function hasUserFork(systemModuleId: string): boolean {
    return userModules.listModules().some(
      (um) => um.metadata.forkedFrom?.moduleId === systemModuleId,
    );
  }

  /** Group modules by category, preserving order. */
  const groupedModules = $derived.by(() => {
    const groups = new SvelteMap<string, SidebarModule[]>();
    for (const mod of filteredModules) {
      const cat = MODULE_CATEGORIES[mod.moduleId] ?? UNCATEGORIZED;
      const list = groups.get(cat);
      if (list) {
        list.push(mod);
      } else {
        groups.set(cat, [mod]);
      }
    }
    return groups;
  });
</script>

<div class="space-y-3">
  <!-- Search -->
  <input
    type="text"
    placeholder="Search conventions..."
    bind:value={search}
    class="w-full px-3 py-2 text-sm bg-bg-card border border-border-subtle rounded-[--radius-md] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary"
  />

  <!-- Filter toggle -->
  {#if onFilterChange}
    <ToggleGroup
      items={[
        { id: "all", label: "All" },
        { id: "system", label: "System" },
        { id: "custom", label: "My Conventions" },
      ]}
      active={filter}
      onSelect={(id) => { onFilterChange?.(id as "all" | "system" | "custom"); }}
      ariaLabel="Module filter"
      compact
    />
  {/if}

  <!-- Grouped module list -->
  <nav class="space-y-3" aria-label="Convention modules">
    {#each [...groupedModules] as [category, mods] (category)}
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
              {#if mod.isCustom}
                <span class="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-accent-primary/15 text-accent-primary">custom</span>
              {:else if hasUserFork(mod.moduleId)}
                <span class="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-500/15 text-amber-400">modified</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </nav>
</div>
