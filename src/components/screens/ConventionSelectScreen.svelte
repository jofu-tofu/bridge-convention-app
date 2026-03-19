<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import { listConventions, ConventionCategory } from "../../conventions/core";
  import type { ConventionConfig } from "../../conventions/core";
  import { getAppStore } from "../../stores/context";
  import { filterConventions } from "../../core/display/filter-conventions";

  const appStore = getAppStore();

  let searchQuery = $state("");
  let activeCategory = $state<ConventionCategory | null>(null);
  let expandedIds = new SvelteSet<string>();

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

  function toggleDetails(id: string) {
    if (expandedIds.has(id)) expandedIds.delete(id);
    else expandedIds.add(id);
  }
</script>

<main class="max-w-3xl mx-auto h-full flex flex-col p-6 pb-0" aria-label="Convention selection">
  <!-- Fixed header: title + search + filters -->
  <div class="shrink-0">
    <div class="flex items-center justify-between mb-2">
      <h1 class="text-3xl font-bold text-text-primary">Bridge Practice</h1>
      <button
        class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
        onclick={() => appStore.navigateToSettings()}
        aria-label="Settings"
        data-testid="settings-button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    </div>
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
    <div class="flex gap-2 mb-4 overflow-x-auto pb-1">
      <button
        class="shrink-0 px-4 py-2 min-h-[--size-touch-target] rounded-full text-sm font-medium transition-colors cursor-pointer
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
          class="shrink-0 px-4 py-2 min-h-[--size-touch-target] rounded-full text-sm font-medium transition-colors cursor-pointer
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
          {@const expanded = expandedIds.has(convention.id)}
          {@const hasDetails = !!convention.teaching?.purpose}
          <div
            class="text-left p-4 rounded-[--radius-lg] bg-bg-card
              border-2 border-transparent hover:border-border-subtle
              transition-colors"
            data-testid="convention-{convention.id}"
          >
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <h2 class="text-lg font-semibold text-text-primary">
                  {convention.name}
                </h2>
                <p class="text-sm text-text-secondary mt-1 line-clamp-2">
                  {convention.description}
                </p>
              </div>
              <div class="flex flex-col items-end gap-2 ml-2 sm:ml-4 shrink-0">
                <span class="text-xs text-text-muted border border-border-subtle rounded-full px-2.5 py-0.5">
                  {convention.category}
                </span>
                <div class="flex items-center gap-2">
                <button
                  class="p-2 rounded-[--radius-lg] bg-bg-hover text-text-secondary hover:text-accent-primary hover:bg-accent-primary/20 transition-colors cursor-pointer"
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
                  class="p-2 rounded-[--radius-lg] bg-bg-hover text-text-secondary hover:text-accent-primary hover:bg-accent-primary/20 transition-colors cursor-pointer"
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
            {#if hasDetails}
              <button
                class="mt-2 text-xs text-text-muted hover:text-text-secondary cursor-pointer flex items-center gap-1 transition-colors"
                onclick={() => toggleDetails(convention.id)}
                aria-expanded={expanded}
                data-testid="details-toggle-{convention.id}"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="transition-transform {expanded ? 'rotate-90' : ''}"
                  aria-hidden="true"
                ><path d="m9 18 6-6-6-6" /></svg>
                Details
              </button>
              {#if expanded}
                <div class="mt-2 pt-2 border-t border-border-subtle text-sm text-text-secondary space-y-2">
                  <p>{convention.teaching?.purpose}</p>
                  {#if convention.teaching?.whenToUse}
                    <p class="text-xs text-text-muted"><span class="font-medium text-text-secondary">When to use:</span> {convention.teaching.whenToUse}</p>
                  {/if}
                </div>
              {/if}
            {/if}
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
