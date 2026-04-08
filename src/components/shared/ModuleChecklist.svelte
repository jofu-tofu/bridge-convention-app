<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import { type CatalogModule, groupByCategory, filterModules } from "./module-catalog";

  interface Props {
    modules: CatalogModule[];
    isSelected: (moduleId: string) => boolean;
    onToggle: (moduleId: string) => void;
    disabledIds?: string[];
    compact?: boolean;
  }

  const { modules, isSelected, onToggle, disabledIds = [], compact = false }: Props = $props();

  let search = $state("");
  const collapsedCategories = new SvelteSet<string>();

  const filtered = $derived(filterModules(modules, search));

  /** User-created modules shown in a separate "My Conventions" section. */
  const userModules = $derived(filtered.filter((m) => m.isCustom));
  /** System modules grouped by category. */
  const systemGrouped = $derived(groupByCategory(filtered.filter((m) => !m.isCustom)));

  const showSearch = $derived(!compact || modules.length >= 8);

  function selectedCount(mods: CatalogModule[]): number {
    return mods.filter((m) => isSelected(m.moduleId)).length;
  }
</script>

{#snippet categorySection(category: string, mods: CatalogModule[])}
  {@const collapsed = collapsedCategories.has(category)}
  {@const selected = selectedCount(mods)}
  <div>
    <button
      class="flex items-center gap-1.5 w-full text-left cursor-pointer group"
      onclick={() => {
        if (collapsed) collapsedCategories.delete(category);
        else collapsedCategories.add(category);
      }}
      aria-expanded={!collapsed}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="shrink-0 text-text-muted transition-transform {collapsed ? '-rotate-90' : ''}"
        aria-hidden="true"
      ><path d="m6 9 6 6 6-6"/></svg>
      <span class="text-[10px] font-semibold text-text-muted/70 uppercase tracking-wider">{category}</span>
      <span class="text-[10px] text-text-muted">({mods.length})</span>
      {#if collapsed}
        <span class="text-[10px] text-text-muted ml-auto">{selected} of {mods.length} selected</span>
      {/if}
    </button>

    {#if !collapsed}
      <div class="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-0.5">
        {#each mods as mod (mod.moduleId)}
          {@const disabled = disabledIds.includes(mod.moduleId)}
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isSelected(mod.moduleId)}
              {disabled}
              onchange={() => onToggle(mod.moduleId)}
              class="accent-accent-primary"
            />
            <span class="text-xs text-text-primary truncate">
              {mod.displayName}
              {#if disabled}
                <span class="text-text-muted">(req)</span>
              {/if}
            </span>
          </label>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<div class="space-y-2">
  {#if showSearch}
    <input
      type="text"
      placeholder="Search conventions..."
      bind:value={search}
      class="w-full px-3 py-2 text-sm bg-bg-base border border-border-subtle rounded-[--radius-md] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary"
    />
  {/if}

  <div class="space-y-1.5">
    {#if userModules.length > 0}
      {@render categorySection("My Conventions", userModules)}
      <div class="border-t border-border-subtle my-2"></div>
    {/if}

    {#each [...systemGrouped] as [category, mods] (category)}
      {@render categorySection(category, mods)}
    {/each}
  </div>
</div>
