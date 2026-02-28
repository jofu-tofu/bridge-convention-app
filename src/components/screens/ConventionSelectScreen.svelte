<script lang="ts">
  import { listConventions } from "../../conventions/core/registry";
  import { ConventionCategory } from "../../conventions/core/types";
  import type { ConventionConfig } from "../../conventions/core/types";
  import { getAppStore } from "../../stores/context";
  import { filterConventions } from "../../display/filter-conventions";

  const appStore = getAppStore();

  let searchQuery = $state("");
  let activeCategory = $state<ConventionCategory | null>(null);

  const filteredConventions = $derived(
    filterConventions(listConventions(), searchQuery, activeCategory),
  );

  const categories = $derived(
    Object.values(ConventionCategory).filter(
      (cat) => listConventions().some((c) => c.category === cat),
    ),
  );

  function handleSelect(config: ConventionConfig) {
    appStore.selectConvention(config);
  }

  function handleLearn(config: ConventionConfig) {
    appStore.navigateToLearning(config);
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
          <div
            class="flex items-center justify-between text-left p-4 rounded-[--radius-lg] bg-bg-card
              border-2 border-transparent hover:border-border-subtle
              transition-colors"
            data-testid="convention-{convention.id}"
          >
            <div class="flex-1 min-w-0">
              <h2 class="text-lg font-semibold text-text-primary">
                {convention.name}
              </h2>
              <p class="text-sm text-text-secondary mt-1 line-clamp-2">
                {convention.description}
              </p>
            </div>
            <div class="flex flex-col items-end gap-2 ml-4 shrink-0">
              <span class="text-xs text-text-muted border border-border-subtle rounded-full px-2.5 py-0.5">
                {convention.category}
              </span>
              <div class="flex items-center gap-2">
              <button
                class="p-2 rounded-xl bg-bg-hover text-text-secondary hover:text-accent-primary hover:bg-accent-primary/20 transition-colors cursor-pointer"
                data-testid="learn-{convention.id}"
                aria-label="Learn {convention.name}"
                onclick={() => handleLearn(convention)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                ><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
              </button>
              <button
                class="p-2 rounded-xl bg-bg-hover text-text-secondary hover:text-accent-primary hover:bg-accent-primary/20 transition-colors cursor-pointer"
                data-testid="practice-{convention.id}"
                aria-label="Practice {convention.name}"
                onclick={() => handleSelect(convention)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                ><polygon points="5 3 19 12 5 21 5 3" /></svg>
              </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="text-center py-12">
        <p class="text-text-muted">No conventions match your search.</p>
      </div>
    {/if}
  </div>
</main>
