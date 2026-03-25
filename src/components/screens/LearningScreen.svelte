<script lang="ts">
  import { getAppStore, getService } from "../../stores/context";
  import type { ModuleCatalogEntry, ModuleLearningViewport } from "../../service";
  import { DESKTOP_MIN } from "../shared/breakpoints.svelte";

  const appStore = getAppStore();
  const service = getService();

  let searchQuery = $state("");
  let innerW = $state(1024);
  let sidebarOpen = $state(false);
  let showAllModules = $state(false);

  const isDesktop = $derived(innerW >= DESKTOP_MIN);

  /** All modules from the service. */
  let allModules = $state<readonly ModuleCatalogEntry[]>([]);

  /** Module learning viewport — fetched when selected module changes. */
  let viewport = $state<ModuleLearningViewport | null>(null);

  // Fetch module catalog on mount
  $effect(() => {
    service.listModules().then((modules) => {
      allModules = modules;
    });
  });

  /** Modules filtered by bundle filter and search query. */
  const filteredModules = $derived.by(() => {
    let modules = [...allModules];

    // Filter by bundle if set (and not showing all)
    const bundleFilter = appStore.learningBundleFilter;
    if (bundleFilter && !showAllModules) {
      modules = modules.filter((m) => m.bundleIds.includes(bundleFilter));
    }

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      modules = modules.filter(
        (m) =>
          m.displayName.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q),
      );
    }

    return modules;
  });

  // Fetch viewport when selected module changes
  $effect(() => {
    const moduleId = appStore.learningModuleId;
    if (!moduleId) {
      viewport = null;
      return;
    }
    service.getModuleLearningViewport(moduleId).then((vp) => {
      viewport = vp;
    });
  });

  function handleModuleClick(moduleId: string) {
    appStore.selectLearningModule(moduleId);
    if (!isDesktop) sidebarOpen = false;
  }

  function handlePractice() {
    if (!viewport) return;
    // Find a bundle that contains this module and navigate to practice
    const bundleId = viewport.bundleIds[0];
    if (bundleId) {
      // Import getConvention to navigate to the game
      import("../../conventions").then(({ getConvention }) => {
        try {
          const config = getConvention(bundleId);
          appStore.selectConvention(config);
        } catch {
          // Bundle not found — no-op
        }
      });
    }
  }

  /** Disclosure label for display. */
  function disclosureLabel(d: string): string {
    switch (d) {
      case "alert": return "Alert";
      case "announcement": return "Announce";
      case "natural": return "Natural";
      case "standard": return "Standard";
      default: return d;
    }
  }

  /** Recommendation badge color. */
  function recommendationClass(r: string | null): string {
    switch (r) {
      case "must": return "bg-accent-success/20 text-accent-success";
      case "should": return "bg-accent-primary/20 text-accent-primary";
      case "may": return "bg-bg-elevated text-text-secondary";
      case "avoid": return "bg-accent-danger/20 text-accent-danger";
      default: return "";
    }
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
          <h2 class="text-sm font-semibold text-text-primary mb-3">Modules</h2>
          <input
            type="text"
            placeholder="Search..."
            aria-label="Search modules"
            bind:value={searchQuery}
            class="w-full bg-bg-card border border-border-subtle rounded-[--radius-md] px-3 py-2 text-sm text-text-primary placeholder-text-muted"
          />
          {#if appStore.learningBundleFilter}
            <button
              class="mt-2 text-xs cursor-pointer transition-colors
                {showAllModules ? 'text-accent-primary' : 'text-text-muted hover:text-text-secondary'}"
              onclick={() => showAllModules = !showAllModules}
            >
              {showAllModules ? "Show bundle only" : "Show all modules"}
            </button>
          {/if}
        </div>
        <nav class="flex-1 overflow-y-auto py-2" aria-label="Module list">
          {#each filteredModules as mod (mod.moduleId)}
            <button
              class="w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer min-h-[--size-touch-target]
                {appStore.learningModuleId === mod.moduleId
                  ? 'bg-accent-primary/10 text-accent-primary font-medium'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}"
              data-testid="module-{mod.moduleId}"
              onclick={() => handleModuleClick(mod.moduleId)}
            >
              <span class="block">{mod.displayName}</span>
              <span class="block text-xs text-text-muted mt-0.5">{mod.surfaceCount} bids</span>
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
          <!-- Module hero -->
          <div class="px-4 sm:px-8 pt-6 sm:pt-8 pb-6 border-b border-border-subtle">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <h1 class="text-2xl font-bold text-text-primary mb-2">{viewport.displayName}</h1>
                <p class="text-base text-text-secondary leading-relaxed">{viewport.description}</p>
                <p class="text-sm text-text-muted mt-2 italic">{viewport.purpose}</p>
              </div>
              <button
                class="shrink-0 px-5 py-2.5 bg-accent-primary text-text-on-accent rounded-[--radius-md] text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer min-h-[--size-touch-target]"
                onclick={handlePractice}
              >
                Practice
              </button>
            </div>
          </div>

          <div class="px-4 sm:px-8 py-6 sm:py-8 space-y-8">
            <!-- Teaching section -->
            {#if viewport.teaching.principle || viewport.teaching.tradeoff || viewport.teaching.commonMistakes.length > 0}
              <section>
                <h2 class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Key Concepts</h2>
                <div class="space-y-3">
                  {#if viewport.teaching.principle}
                    <div class="bg-bg-card rounded-[--radius-lg] border border-border-subtle p-4">
                      <h3 class="text-xs font-semibold text-accent-primary mb-1">Principle</h3>
                      <p class="text-sm text-text-primary leading-relaxed">{viewport.teaching.principle}</p>
                    </div>
                  {/if}
                  {#if viewport.teaching.tradeoff}
                    <div class="bg-bg-card rounded-[--radius-lg] border border-border-subtle p-4">
                      <h3 class="text-xs font-semibold text-text-secondary mb-1">Tradeoff</h3>
                      <p class="text-sm text-text-primary leading-relaxed">{viewport.teaching.tradeoff}</p>
                    </div>
                  {/if}
                  {#if viewport.teaching.commonMistakes.length > 0}
                    <div class="bg-bg-card rounded-[--radius-lg] border border-border-subtle p-4">
                      <h3 class="text-xs font-semibold text-accent-danger mb-1">Common Mistakes</h3>
                      <ul class="space-y-1.5">
                        {#each viewport.teaching.commonMistakes as mistake, i (i)}
                          <li class="text-sm text-text-primary leading-relaxed flex gap-2">
                            <span class="shrink-0 text-text-muted">-</span>
                            <span>{mistake}</span>
                          </li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                </div>
              </section>
            {/if}

            <!-- Conversation flow: surfaces grouped by phase -->
            <section>
              <h2 class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Bidding Conversation</h2>
              <div class="space-y-4">
                {#each viewport.phases as phase (phase.phase)}
                  <div class="bg-bg-card rounded-[--radius-lg] border border-border-subtle overflow-hidden">
                    <!-- Phase header -->
                    <div class="px-4 py-3 border-b border-border-subtle bg-bg-elevated/50">
                      <h3 class="text-sm font-semibold text-text-primary">{phase.phaseDisplay}</h3>
                    </div>
                    <!-- Surface list -->
                    <div class="divide-y divide-border-subtle">
                      {#each phase.surfaces as surface (surface.meaningId)}
                        <div class="px-4 py-3">
                          <div class="flex items-center gap-3 mb-1">
                            <span class="font-mono text-sm font-bold text-text-primary">{surface.callDisplay}</span>
                            <span class="text-sm text-text-secondary">{surface.teachingLabel}</span>
                            {#if surface.recommendation}
                              <span class="text-xs font-medium px-2 py-0.5 rounded-full {recommendationClass(surface.recommendation)}">
                                {surface.recommendation}
                              </span>
                            {/if}
                            <span class="text-xs text-text-muted">{disclosureLabel(surface.disclosure)}</span>
                          </div>
                          {#if surface.explanationText && surface.explanationText !== "internal"}
                            <p class="text-xs text-text-muted leading-relaxed mt-1">{surface.explanationText}</p>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            </section>
          </div>
        </div>
      {:else if appStore.learningModuleId}
        <div class="text-center py-12 text-text-muted">
          Loading module data...
        </div>
      {:else}
        <div class="text-center py-12 text-text-muted">
          Select a module from the sidebar.
        </div>
      {/if}
    </div>
  </div>
</main>
