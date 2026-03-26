<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import { listConventions, ConventionCategory, displayConventionName } from "../../service";
  import type { ConventionConfig } from "../../service";
  import { getAppStore } from "../../stores/context";
  import { filterConventions } from "./filter-conventions";

  const appStore = getAppStore();

  let searchQuery = $state("");
  let activeCategory = $state<ConventionCategory | null>(null);
  let expandedIds = new SvelteSet<string>();

  const allConventions = $derived(listConventions());

  const filteredConventions = $derived(
    filterConventions(allConventions, searchQuery, activeCategory),
  );

  const categories = $derived(
    Object.values(ConventionCategory).filter(
      (cat) => allConventions.some((c) => c.category === cat),
    ),
  );

  function handleSelect(config: ConventionConfig) {
    appStore.selectConvention(config);
  }

  function handleLearn(config: ConventionConfig) {
    appStore.navigateToLearning(config);
  }

  function handleLearnModule(moduleId: string, bundleId: string) {
    appStore.navigateToLearningModule(moduleId, bundleId);
  }

  function toggleCategory(cat: ConventionCategory) {
    activeCategory = activeCategory === cat ? null : cat;
  }

  function toggleDetails(id: string) {
    if (expandedIds.has(id)) expandedIds.delete(id);
    else expandedIds.add(id);
  }

  const displayName = displayConventionName;

  function formatModuleName(moduleId: string): string {
    return moduleId
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

</script>

<main class="max-w-3xl mx-auto h-full flex flex-col p-6 pb-0" aria-label="Convention selection">
  <!-- Fixed header: title + search + filters -->
  <div class="shrink-0">
    <h1 class="text-3xl font-bold tracking-tight text-text-primary mb-1">Bridge Practice</h1>
    <p class="text-text-secondary mb-5">Select a convention to learn or practice.</p>

    <!-- Search -->
    <div class="mb-4">
      <div
        class="flex items-center gap-3 bg-bg-card border border-border-subtle rounded-[--radius-lg] px-4 py-3 transition-colors focus-within:border-accent-primary/40"
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
          class="text-text-muted shrink-0"
          aria-hidden="true"
          ><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg
        >
        <input
          type="text"
          placeholder="Search conventions..."
          aria-label="Search conventions"
          bind:value={searchQuery}
          class="w-full bg-transparent text-text-primary placeholder-text-muted outline-none"
        />
      </div>
    </div>

    <!-- Category filters -->
    <div class="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
      <button
        class="shrink-0 px-4 py-1.5 min-h-[--size-touch-target] rounded-full text-sm font-semibold transition-all cursor-pointer
          {activeCategory === null
          ? 'bg-accent-primary text-text-on-accent shadow-sm'
          : 'bg-bg-card text-text-secondary hover:text-text-primary hover:bg-bg-elevated border border-border-subtle'}"
        aria-pressed={activeCategory === null}
        onclick={() => (activeCategory = null)}
      >
        All
      </button>
      {#each categories as cat (cat)}
        <button
          class="shrink-0 px-4 py-1.5 min-h-[--size-touch-target] rounded-full text-sm font-semibold transition-all cursor-pointer
            {activeCategory === cat
            ? 'bg-accent-primary text-text-on-accent shadow-sm'
            : 'bg-bg-card text-text-secondary hover:text-text-primary hover:bg-bg-elevated border border-border-subtle'}"
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
        {#each filteredConventions as convention, i (convention.id)}
          {@const expanded = expandedIds.has(convention.id)}
          {@const hasDetails = !!convention.teaching?.purpose}
          <div
            class="group text-left p-4 rounded-[--radius-lg] bg-bg-card
              border border-border-subtle hover:border-border-default
              transition-all hover:shadow-md"
            style="animation: fadeIn 0.3s ease-out {i * 0.04}s both;"
            data-testid="convention-{convention.id}"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <h2 class="text-lg font-semibold text-text-primary leading-tight">
                  {displayName(convention.name)}
                </h2>
                <p class="text-sm text-text-secondary mt-1.5 leading-relaxed line-clamp-2">
                  {convention.description}
                </p>
              </div>
              <div class="flex flex-col items-end gap-3 shrink-0">
                <div class="flex items-center gap-1.5 flex-wrap justify-end">
                  {#if convention.variesBySystem}
                    <span class="text-xs font-medium text-text-muted bg-bg-elevated rounded-full px-2.5 py-1">
                      Varies by system
                    </span>
                  {/if}
                  <span class="text-xs font-medium text-text-muted bg-bg-elevated rounded-full px-2.5 py-1">
                    {convention.category}
                  </span>
                </div>
                <div class="flex items-center gap-1.5">
                  <button
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-[--radius-md] text-xs font-medium
                      text-text-secondary bg-bg-elevated hover:text-accent-primary hover:bg-accent-primary/10
                      transition-all cursor-pointer border border-transparent hover:border-accent-primary/20"
                    data-testid="learn-{convention.id}"
                    aria-label="Learn {displayName(convention.name)}"
                    onclick={() => handleLearn(convention)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                    Learn
                  </button>
                  <button
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-[--radius-md] text-xs font-medium
                      text-text-on-accent bg-accent-primary hover:bg-accent-primary-hover
                      transition-all cursor-pointer shadow-sm"
                    data-testid="practice-{convention.id}"
                    aria-label="Practice {displayName(convention.name)}"
                    onclick={() => handleSelect(convention)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    Practice
                  </button>
                </div>
              </div>
            </div>
            {#if hasDetails}
              <button
                class="mt-2.5 text-xs text-text-muted hover:text-text-secondary cursor-pointer flex items-center gap-1 transition-colors"
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
                  {#if convention.moduleDescriptions?.size}
                    <div class="mt-2 space-y-1">
                      <p class="text-xs font-medium text-text-secondary">Conventions in this bundle:</p>
                      {#each [...convention.moduleDescriptions.entries()] as [moduleId, desc] (moduleId)}
                        <div class="flex items-center gap-2 pl-2">
                          <button
                            class="text-xs text-accent-primary hover:underline cursor-pointer"
                            data-testid="learn-module-{moduleId}"
                            onclick={() => handleLearnModule(moduleId, convention.id)}
                          >
                            {formatModuleName(moduleId)}
                          </button>
                          <span class="text-xs text-text-muted">— {desc}</span>
                        </div>
                      {/each}
                    </div>
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

<style>
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .scrollbar-none {
    scrollbar-width: none;
  }
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }
</style>
