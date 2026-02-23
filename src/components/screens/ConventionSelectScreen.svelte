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

<main class="max-w-3xl mx-auto h-full flex flex-col p-6 pb-0" aria-label="Convention selection">
  <!-- Fixed header: title + search + filters -->
  <div class="shrink-0">
    <h1 class="text-3xl font-bold text-text-primary mb-2">Bridge Practice</h1>
    <p class="text-text-secondary mb-6">Select a convention to begin drilling.</p>

    <!-- Search -->
    <div class="mb-4">
      <div
        class="flex items-center gap-3 bg-bg-card border border-border-subtle rounded-[--radius-lg] px-4 py-3"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-text-secondary shrink-0"
          aria-hidden="true"
          ><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg
        >
        <input
          type="text"
          placeholder="Search conventions..."
          aria-label="Search conventions"
          bind:value={searchQuery}
          class="w-full bg-transparent text-text-primary placeholder-text-muted"
        />
      </div>
    </div>

    <!-- Category filters -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <button
        class="px-4 py-2 min-h-[--size-touch-target] rounded-full text-sm font-medium transition-colors cursor-pointer
          {activeCategory === null
          ? 'bg-accent-primary text-text-on-accent'
          : 'bg-bg-card text-text-secondary hover:bg-bg-hover border border-border-subtle'}"
        aria-pressed={activeCategory === null}
        onclick={() => (activeCategory = null)}
      >
        All
      </button>
      {#each categories as cat (cat)}
        <button
          class="px-4 py-2 min-h-[--size-touch-target] rounded-full text-sm font-medium transition-colors cursor-pointer
            {activeCategory === cat
            ? 'bg-accent-primary text-text-on-accent'
            : 'bg-bg-card text-text-secondary hover:bg-bg-hover border border-border-subtle'}"
          aria-pressed={activeCategory === cat}
          onclick={() => toggleCategory(cat)}
        >
          {cat}
        </button>
      {/each}
    </div>
  </div>

  <!-- Scrollable convention list -->
  <div class="min-h-0 flex-1 overflow-y-auto pb-6">
    {#if filteredConventions.length > 0}
      <div class="grid grid-cols-1 gap-3">
        {#each filteredConventions as convention (convention.id)}
          <button
            class="flex items-center justify-between text-left p-4 rounded-[--radius-lg] bg-bg-card
              border-2 border-transparent hover:border-accent-primary
              transition-colors cursor-pointer"
            onclick={() => handleSelect(convention)}
          >
            <div>
              <h2 class="text-lg font-semibold text-text-primary">
                {convention.name}
              </h2>
              <p class="text-sm text-text-secondary mt-1">
                {convention.description}
              </p>
            </div>
            <span
              class="rounded-full bg-bg-hover text-text-secondary text-xs font-medium px-3 py-1 ml-4 shrink-0"
            >
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
</main>
