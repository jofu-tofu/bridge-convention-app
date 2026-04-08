<script lang="ts">
  import { listConventions, ConventionCategory, displayConventionName } from "../../service";
  import type { ConventionInfo } from "../../service";
  import { getAppStore } from "../../stores/context";
  import { filterConventions } from "./filter-conventions";
  import ItemCard from "../shared/ItemCard.svelte";

  const appStore = getAppStore();

  let searchQuery = $state("");
  let activeCategory = $state<ConventionCategory | null>(null);

  const allConventions = $derived(listConventions());

  const filteredConventions = $derived(
    filterConventions(allConventions, searchQuery, activeCategory),
  );

  const categories = $derived(
    Object.values(ConventionCategory).filter(
      (cat) => allConventions.some((c) => c.category === cat),
    ),
  );

  function handleSelect(config: ConventionInfo) {
    appStore.selectConvention(config);
  }

  function handleLearn(config: ConventionInfo) {
    appStore.navigateToLearning(config);
  }

  const lastPracticedConvention = $derived(
    allConventions.find((c) => c.id === appStore.lastPracticedId) ?? null,
  );

  function toggleCategory(cat: ConventionCategory) {
    activeCategory = activeCategory === cat ? null : cat;
  }

  const displayName = displayConventionName;
</script>

<main class="max-w-5xl mx-auto h-full flex flex-col p-6 pb-0" aria-label="Convention selection">
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

  <!-- Scrollable convention grid -->
  <div class="min-h-0 flex-1 overflow-y-auto pb-6">
    {#if lastPracticedConvention && !searchQuery && !activeCategory}
      <!-- Continue Practicing card -->
      <div
        class="flex items-center justify-between gap-4 p-4 mb-4 rounded-[--radius-lg]
          bg-accent-primary/8 border border-accent-primary/20"
        data-testid="continue-practicing"
      >
        <div class="min-w-0">
          <p class="text-xs font-medium text-accent-primary uppercase tracking-wide mb-0.5">Continue Practicing</p>
          <p class="text-base font-semibold text-text-primary truncate">
            {displayName(lastPracticedConvention.name)}
          </p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-[--radius-md] text-xs font-medium
              text-text-secondary bg-bg-elevated hover:text-accent-primary hover:bg-accent-primary/10
              transition-all cursor-pointer border border-transparent hover:border-accent-primary/20"
            aria-label="Learn {displayName(lastPracticedConvention.name)}"
            onclick={() => handleLearn(lastPracticedConvention)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
            Learn
          </button>
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-[--radius-md] text-xs font-medium
              text-text-on-accent bg-accent-primary hover:bg-accent-primary-hover
              transition-all cursor-pointer shadow-sm"
            aria-label="Practice {displayName(lastPracticedConvention.name)}"
            onclick={() => handleSelect(lastPracticedConvention)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            Practice
          </button>
        </div>
      </div>
    {/if}

    {#if filteredConventions.length > 0}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {#each filteredConventions as convention (convention.id)}
          <ItemCard testId="convention-{convention.id}" interactive={false}>
            <div class="flex items-start justify-between gap-2">
              <h2 class="text-lg font-semibold text-text-primary leading-tight">
                {displayName(convention.name)}
              </h2>
              <div class="flex items-center gap-1.5 shrink-0">
                {#if convention.variesBySystem}
                  <span class="text-xs font-medium text-text-muted bg-bg-elevated rounded-full px-2 py-0.5">
                    Varies by system
                  </span>
                {/if}
                <span class="text-xs font-medium text-text-muted bg-bg-elevated rounded-full px-2 py-0.5">
                  {convention.category}
                </span>
              </div>
            </div>
            <p class="text-sm text-text-secondary mt-1 leading-relaxed line-clamp-2">
              {convention.description}
            </p>
            <div class="flex items-center justify-end gap-1.5 mt-2">
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
          </ItemCard>
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
  .scrollbar-none {
    scrollbar-width: none;
  }
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }
</style>
