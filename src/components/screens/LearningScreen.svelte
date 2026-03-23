<script lang="ts">
  import { getAppStore, getService } from "../../stores/context";
  import { listConventions } from "../../conventions";
  import type { ConventionConfig } from "../../core/contracts/convention";
  import type { LearningViewport } from "../../service";
  import { filterConventions } from "../../core/display/filter-conventions";
  import { displayConventionName } from "../../core/display/format";
  import { DESKTOP_MIN } from "../../core/display/breakpoints.svelte";

  const appStore = getAppStore();
  const service = getService();

  let searchQuery = $state("");
  let innerW = $state(1024);
  let sidebarOpen = $state(false);

  const isDesktop = $derived(innerW >= DESKTOP_MIN);

  const config = $derived(appStore.learningConvention);

  const filteredConventions = $derived(
    filterConventions(listConventions(), searchQuery, null),
  );

  /** Learning viewport — fetched from service when config changes. */
  let viewport = $state<LearningViewport | null>(null);

  $effect(() => {
    const id = config?.id;
    if (!id) {
      viewport = null;
      return;
    }
    service.getLearningViewport(id).then((vp) => {
      viewport = vp;
    });
  });

  const hasMultipleModules = $derived((viewport?.modules.length ?? 0) > 1);

  function handleConventionClick(conv: ConventionConfig) {
    appStore.navigateToLearning(conv);
    if (!isDesktop) sidebarOpen = false;
  }
</script>

<svelte:window bind:innerWidth={innerW} />

<main class="h-full flex flex-col bg-bg-base" aria-label="Convention learning">
  <!-- Header breadcrumb -->
  <header class="shrink-0 px-6 py-4 border-b border-border-subtle flex items-center gap-3">
    {#if !isDesktop}
      <button
        data-testid="sidebar-toggle"
        class="shrink-0 p-1 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        aria-label="Toggle sidebar"
        onclick={() => sidebarOpen = !sidebarOpen}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/></svg>
      </button>
    {/if}
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

  <div class="flex flex-1 min-h-0 relative">
    <!-- Sidebar overlay backdrop (mobile only) -->
    {#if !isDesktop && sidebarOpen}
      <button
        data-testid="sidebar-overlay"
        class="fixed inset-0 bg-black/50 z-[--z-overlay] cursor-default"
        aria-label="Close sidebar"
        onclick={() => sidebarOpen = false}
      ></button>
    {/if}

    <!-- Sidebar -->
    {#if isDesktop || sidebarOpen}
      <aside class="{isDesktop
        ? 'w-[280px] shrink-0 border-r border-border-subtle flex flex-col'
        : 'fixed inset-y-0 left-0 w-[280px] z-[--z-modal] bg-bg-base border-r border-border-subtle flex flex-col'}">
        <div class="p-4 border-b border-border-subtle">
          <h2 class="text-sm font-semibold text-text-primary mb-3">Conventions</h2>
        <input
          type="text"
          placeholder="Search..."
          aria-label="Search conventions"
          bind:value={searchQuery}
          class="w-full bg-bg-card border border-border-subtle rounded-[--radius-md] px-3 py-2 text-sm text-text-primary placeholder-text-muted"
        />
      </div>
      <nav class="flex-1 overflow-y-auto py-2" aria-label="Convention list">
        {#each filteredConventions as conv (conv.id)}
          <button
            class="w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer min-h-[--size-touch-target]
              {config?.id === conv.id
                ? 'bg-accent-primary/10 text-accent-primary font-medium'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}"
            onclick={() => handleConventionClick(conv)}
          >
            {displayConventionName(conv.name)}
          </button>
        {/each}
      </nav>
    </aside>
    {/if}

    <!-- Main content -->
    <div class="flex-1 flex flex-col min-h-0">
      {#if viewport}
        <!-- Scrollable content -->
        <div class="flex-1 overflow-y-auto">
          <!-- Convention hero -->
          <div class="px-4 sm:px-8 pt-6 sm:pt-8 pb-6 border-b border-border-subtle">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="flex items-center gap-3 mb-2">
                  <h1 class="text-2xl font-bold text-text-primary">{viewport.name}</h1>
                  <span class="shrink-0 rounded-full bg-bg-hover text-text-secondary text-xs font-medium px-3 py-1">
                    {viewport.category}
                  </span>
                </div>
                <p class="text-base text-text-secondary leading-relaxed">{viewport.description}</p>
              </div>
              <button
                class="shrink-0 px-5 py-2.5 bg-accent-primary text-text-on-accent rounded-[--radius-md] text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer min-h-[--size-touch-target]"
                onclick={() => config && appStore.selectConvention(config)}
              >
                Practice
              </button>
            </div>
          </div>

          <div class="px-4 sm:px-8 py-6 sm:py-8 space-y-8">
            <!-- Purpose -->
            {#if viewport.purpose}
              <section>
                <h2 class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Why it exists</h2>
                <p class="text-sm text-text-primary leading-relaxed">{viewport.purpose}</p>
              </section>
            {/if}

            <!-- Module breakdown (multi-module bundles only) -->
            {#if hasMultipleModules}
              <section>
                <h2 class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Conventions in this bundle</h2>
                <div class="grid gap-3">
                  {#each viewport.modules as mod (mod.moduleId)}
                    <div class="bg-bg-card rounded-[--radius-lg] border border-border-subtle p-4">
                      <div class="flex items-center justify-between mb-1">
                        <h3 class="text-sm font-semibold text-text-primary">{mod.displayName}</h3>
                        <span class="text-xs text-text-muted">{mod.surfaceCount} bids</span>
                      </div>
                      <p class="text-sm text-text-secondary">{mod.description}</p>
                      <p class="text-xs text-text-muted mt-2 italic">{mod.purpose}</p>
                    </div>
                  {/each}
                </div>
              </section>
            {/if}

            <!-- Placeholder: Bidding conversation flow -->
            <!-- Future: render from viewport.modules[].surfaces grouped by FSM phase -->

            <!-- Placeholder: Example hands -->
            <!-- Future: service generates constrained hands, returns in viewport -->

            <!-- Placeholder: Quick reference table -->
            <!-- Future: render from viewport.modules[].surfaces -->
          </div>
        </div>
      {:else if config}
        <div class="text-center py-12 text-text-muted">
          Loading convention data...
        </div>
      {:else}
        <div class="text-center py-12 text-text-muted">
          Select a convention from the sidebar.
        </div>
      {/if}
    </div>
  </div>
</main>
