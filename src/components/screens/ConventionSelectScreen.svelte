<script lang="ts">
  import { listConventions } from "../../conventions/registry";
  import { ConventionCategory } from "../../conventions/types";
  import type { ConventionConfig } from "../../conventions/types";
  import { getAppStore } from "../../lib/context";
  import { filterConventions } from "../../lib/filter-conventions";

  const appStore = getAppStore();

  let searchQuery = $state("");
  let activeCategory = $state<ConventionCategory | null>(null);

  const filteredConventions = $derived(
    filterConventions(listConventions(), searchQuery, activeCategory),
  );

  const categories = Object.values(ConventionCategory);

  function handleSelect(config: ConventionConfig) {
    appStore.selectConvention(config);
  }

  function toggleCategory(cat: ConventionCategory) {
    activeCategory = activeCategory === cat ? null : cat;
  }
</script>

<div class="max-w-3xl mx-auto p-6">
  <h1 class="text-3xl font-bold text-text-primary mb-2">Bridge Practice</h1>
  <p class="text-text-secondary mb-6">Select a convention to begin drilling.</p>

  <!-- Search -->
  <div class="mb-4">
    <input
      type="text"
      placeholder="Search conventions..."
      bind:value={searchQuery}
      class="w-full px-4 py-2 bg-bg-card border border-border-default rounded-[--radius-md]
        text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary
        transition-colors"
    />
  </div>

  <!-- Category filters -->
  <div class="flex gap-2 mb-6 flex-wrap">
    {#each categories as cat (cat)}
      <button
        class="px-3 py-1.5 rounded-[--radius-md] text-sm font-medium transition-colors cursor-pointer
          {activeCategory === cat
            ? 'bg-accent-primary text-white'
            : 'bg-bg-card text-text-secondary hover:bg-bg-hover border border-border-subtle'
          }"
        onclick={() => toggleCategory(cat)}
      >
        {cat}
      </button>
    {/each}
  </div>

  <!-- Convention cards -->
  {#if filteredConventions.length > 0}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {#each filteredConventions as convention (convention.id)}
        <button
          class="text-left p-4 rounded-[--radius-lg] bg-bg-card
            border border-border-subtle hover:border-accent-primary
            transition-colors cursor-pointer"
          onclick={() => handleSelect(convention)}
        >
          <h2 class="text-lg font-semibold text-text-primary">{convention.name}</h2>
          <p class="text-sm text-text-secondary mt-1">{convention.description}</p>
          <span class="inline-block mt-2 px-2 py-0.5 rounded-[--radius-sm] text-xs bg-bg-elevated text-text-muted">
            {convention.category}
          </span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="text-center py-12">
      <p class="text-text-muted">No conventions match your search.</p>
    </div>
  {/if}
</div>
