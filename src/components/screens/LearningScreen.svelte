<script lang="ts">
  import { getAppStore } from "../../stores/context";
  import { listConventions } from "../../conventions/core/registry";
  import type { ConventionConfig } from "../../conventions/core/types";
  import type { ConventionTeaching } from "../../conventions/core/types";
  import { filterConventions } from "../../core/display/filter-conventions";

  const appStore = getAppStore();

  let searchQuery = $state("");
  let depthMode = $state<"compact" | "study" | "learn">("study");
  let headerCollapsed = $state(false);

  const config = $derived(appStore.learningConvention);

  const filteredConventions = $derived(
    filterConventions(listConventions(), searchQuery, null),
  );

  const conventionTeaching = $derived<ConventionTeaching | null>(
    config?.explanations?.convention ?? config?.teaching ?? null,
  );

  function handleConventionClick(conv: ConventionConfig) {
    appStore.navigateToLearning(conv);
  }
</script>

<main class="h-full flex flex-col bg-bg-base" aria-label="Convention learning">
  <!-- Header breadcrumb -->
  <header class="shrink-0 px-6 py-4 border-b border-border-subtle">
    <button
      class="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
      aria-label="Back to convention selection"
      onclick={() => appStore.navigateToMenu()}
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
        aria-hidden="true"
      ><path d="m15 18-6-6 6-6" /></svg>
      <span class="text-sm">Bridge Practice / Learn</span>
    </button>
  </header>

  <div class="flex flex-1 min-h-0">
    <!-- Sidebar -->
    <aside class="w-[280px] shrink-0 border-r border-border-subtle flex flex-col">
      <div class="p-4 border-b border-border-subtle">
        <h2 class="text-sm font-semibold text-text-primary mb-3">Conventions</h2>
        <input
          type="text"
          placeholder="Search..."
          aria-label="Search conventions"
          bind:value={searchQuery}
          class="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted"
        />
      </div>
      <nav class="flex-1 overflow-y-auto py-2" aria-label="Convention list">
        {#each filteredConventions as conv (conv.id)}
          <button
            class="w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer
              {config?.id === conv.id
                ? 'bg-accent-primary/10 text-accent-primary font-medium'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}"
            onclick={() => handleConventionClick(conv)}
          >
            {conv.name}
          </button>
        {/each}
      </nav>
    </aside>

    <!-- Main content -->
    <div class="flex-1 overflow-y-auto p-8 space-y-7">
      {#if config}
        <!-- Convention header -->
        <div>
          <div class="flex items-center gap-3 mb-2">
            <h1 class="text-3xl font-bold text-text-primary">{config.name}</h1>
            <span class="rounded-full bg-bg-hover text-text-secondary text-xs font-medium px-3 py-1">
              {config.category}
            </span>
          </div>
          <p class="text-text-secondary">{config.description}</p>
        </div>

        <!-- Depth mode tabs -->
        <div class="flex gap-1 bg-[#1c2530] rounded-lg p-1" role="tablist" aria-label="Detail level">
          {#each [
            { mode: "compact" as const, label: "Compact" },
            { mode: "study" as const, label: "Study" },
            { mode: "learn" as const, label: "Learn" },
          ] as tab (tab.mode)}
            <button
              role="tab"
              aria-selected={depthMode === tab.mode}
              class="px-4 py-2 text-sm rounded-md transition-colors cursor-pointer
                {depthMode === tab.mode
                  ? 'bg-accent-primary text-text-on-accent font-medium'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}"
              onclick={() => depthMode = tab.mode}
            >
              {tab.label}
            </button>
          {/each}
        </div>

        <!-- Convention teaching header card (Study + Learn) -->
        {#if conventionTeaching && depthMode !== "compact"}
          <section class="bg-[#1c2530] rounded-xl border border-border-subtle">
            <button
              class="w-full flex items-center justify-between px-5 py-4 cursor-pointer"
              aria-expanded={!headerCollapsed}
              aria-controls="convention-teaching-content"
              onclick={() => headerCollapsed = !headerCollapsed}
            >
              <h2 class="text-lg font-semibold text-text-primary">About This Convention</h2>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="text-slate-400 transition-transform {headerCollapsed ? '' : 'rotate-180'}"
                aria-hidden="true"
              >
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
            {#if !headerCollapsed}
              <div id="convention-teaching-content" class="px-5 pb-5 space-y-3">
                {#if conventionTeaching.purpose}
                  <div>
                    <span class="text-xs font-semibold text-slate-400 uppercase tracking-wide">Purpose</span>
                    <p class="text-sm text-slate-200 mt-1">{conventionTeaching.purpose}</p>
                  </div>
                {/if}
                {#if conventionTeaching.whenToUse}
                  <div>
                    <span class="text-xs font-semibold text-slate-400 uppercase tracking-wide">When to use</span>
                    <p class="text-sm text-slate-200 mt-1">{conventionTeaching.whenToUse}</p>
                  </div>
                {/if}
                {#if conventionTeaching.roles}
                  <div>
                    <span class="text-xs font-semibold text-slate-400 uppercase tracking-wide">Roles</span>
                    <p class="text-sm text-slate-200 mt-1">{conventionTeaching.roles}</p>
                  </div>
                {/if}
                <!-- Learn-only fields -->
                {#if depthMode === "learn"}
                  {#if conventionTeaching.whenNotToUse && conventionTeaching.whenNotToUse.length > 0}
                    <div>
                      <span class="text-xs font-semibold text-amber-400 uppercase tracking-wide">When not to use</span>
                      <ul class="text-sm text-slate-200 mt-1 list-disc list-inside space-y-1">
                        {#each conventionTeaching.whenNotToUse as item (item)}
                          <li>{item}</li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                  {#if conventionTeaching.tradeoff}
                    <div>
                      <span class="text-xs font-semibold text-slate-400 uppercase tracking-wide">Tradeoff</span>
                      <p class="text-sm text-slate-200 mt-1">{conventionTeaching.tradeoff}</p>
                    </div>
                  {/if}
                  {#if conventionTeaching.principle}
                    <div>
                      <span class="text-xs font-semibold text-slate-400 uppercase tracking-wide">Principle</span>
                      <p class="text-sm text-slate-200 mt-1">{conventionTeaching.principle}</p>
                    </div>
                  {/if}
                {/if}
              </div>
            {/if}
          </section>
        {/if}

        <hr class="border-border-subtle" />

        <!-- Decision Tree placeholder — protocol conventions don't produce a single tree root.
             Future: protocol-aware tree display. -->
        <div class="text-text-muted italic py-8 text-center">
          No decision tree available for this convention.
        </div>

        <hr class="border-border-subtle" />

        <!-- Practice button -->
        <div class="pb-8">
          <button
            class="px-6 py-3 bg-accent-primary text-text-on-accent rounded-lg font-medium hover:opacity-90 transition-opacity cursor-pointer"
            onclick={() => config && appStore.selectConvention(config)}
          >
            Practice This Convention
          </button>
        </div>
      {:else}
        <div class="text-center py-12 text-text-muted">
          Select a convention from the sidebar.
        </div>
      {/if}
    </div>
  </div>
</main>
