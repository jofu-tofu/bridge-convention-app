<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import { getAppStore, getService } from "../../stores/context";
  import type { ModuleCatalogEntry, ModuleLearningViewport, ClauseSystemVariant, BundleFlowTreeViewport } from "../../service";
  import { DESKTOP_MIN } from "../shared/breakpoints.svelte";
  import ConversationFlowTree from "./ConversationFlowTree.svelte";

  const appStore = getAppStore();
  const service = getService();

  let searchQuery = $state("");
  let innerW = $state(1024);
  let sidebarOpen = $state(false);
  let expandedClauses = new SvelteSet<string>();

  /** Active variance popover state — fixed-positioned to escape overflow containers. */
  let variancePopover = $state<{
    variants: readonly ClauseSystemVariant[];
    x: number;
    y: number;
    flipUp: boolean;
  } | null>(null);

  function toggleClauses(meaningId: string) {
    if (expandedClauses.has(meaningId)) expandedClauses.delete(meaningId);
    else expandedClauses.add(meaningId);
  }

  function showVariance(e: MouseEvent, variants: readonly ClauseSystemVariant[]) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Flip above if near bottom of viewport (rough estimate: 80px for tooltip)
    const flipUp = rect.bottom + 80 > window.innerHeight;
    variancePopover = {
      variants,
      x: rect.left,
      y: flipUp ? rect.top : rect.bottom + 4,
      flipUp,
    };
  }

  function hideVariance() {
    variancePopover = null;
  }

  const isDesktop = $derived(innerW >= DESKTOP_MIN);

  /** All modules from the service. */
  let allModules = $state<readonly ModuleCatalogEntry[]>([]);

  /** Module learning viewport — fetched when selected module changes. */
  let viewport = $state<ModuleLearningViewport | null>(null);

  /** Bundle flow tree — fetched when bundle filter changes. */
  let flowTree = $state<BundleFlowTreeViewport | null>(null);

  // Fetch module catalog on mount, auto-select first module if none selected
  $effect(() => {
    service.listModules().then((modules) => {
      allModules = modules;
      if (!appStore.learningModuleId && modules.length > 0) {
        appStore.selectLearningModule(modules[0]!.moduleId);
      }
    });
  });

  // Fetch flow tree when bundle filter changes
  $effect(() => {
    const bundleId = appStore.learningBundleFilter;
    if (bundleId) {
      service.getBundleFlowTree(bundleId).then((t) => { flowTree = t; });
    } else {
      flowTree = null;
    }
  });

  /** Modules filtered by bundle filter and search query. */
  const filteredModules = $derived.by(() => {
    let modules = [...allModules];

    // Filter by bundle if set
    const bundleFilter = appStore.learningBundleFilter;
    if (bundleFilter) {
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
    <h2 class="text-sm font-medium text-text-secondary">Learn</h2>
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
          {#if appStore.learningBundleFilter && appStore.learningBundleFilterName}
            <div class="mt-2 flex items-center gap-1.5">
              <span
                class="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-[--radius-md] bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-xs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="shrink-0 opacity-60"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                {appStore.learningBundleFilterName}
                <button
                  data-testid="clear-bundle-filter"
                  class="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-accent-primary/25 transition-colors cursor-pointer"
                  aria-label="Clear bundle filter"
                  onclick={() => appStore.clearBundleFilter()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </span>
            </div>
          {/if}
        </div>
        <nav class="flex-1 overflow-y-auto py-2" aria-label="Convention list">
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

          <!-- Conversation flow tree (desktop only, when bundle filter is active) -->
          {#if flowTree && isDesktop}
            <section class="px-4 sm:px-8 py-6">
              <h2 class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Conversation Flow</h2>
              <div class="overflow-x-auto bg-bg-card rounded-[--radius-lg] border border-border-subtle p-4">
                <ConversationFlowTree
                  tree={flowTree}
                  selectedModuleId={appStore.learningModuleId}
                  onNodeClick={(moduleId) => appStore.selectLearningModule(moduleId)}
                />
              </div>
            </section>
          {/if}

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
                          {#if surface.clauses.length > 0}
                            <button class="text-xs text-text-muted hover:text-text-secondary mt-1 cursor-pointer"
                              onclick={() => toggleClauses(surface.meaningId)}>
                              {expandedClauses.has(surface.meaningId) ? '\u25BE' : '\u25B8'}
                              {surface.clauses.length} requirement{surface.clauses.length === 1 ? '' : 's'}
                            </button>
                            {#if expandedClauses.has(surface.meaningId)}
                              <div class="mt-2 ml-4 space-y-1">
                                {#each surface.clauses as clause, i (i)}
                                  <div class="text-xs {clause.isPublic ? 'text-text-secondary' : 'text-text-muted italic'} flex items-center gap-1.5">
                                    <span>{clause.description}</span>
                                    {#if clause.systemVariants}
                                      <button
                                        class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 cursor-pointer hover:bg-amber-500/25 transition-colors"
                                        aria-label="Show per-system details"
                                        onclick={(e) => showVariance(e, clause.systemVariants!)}
                                      >
                                        varies by system
                                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-70" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                                      </button>
                                    {/if}
                                  </div>
                                {/each}
                              </div>
                            {/if}
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
          Loading convention data...
        </div>
      {:else}
        <div class="text-center py-12 text-text-muted">
          Select a convention from the sidebar.
        </div>
      {/if}
    </div>
  </div>

  <!-- Fixed-position variance popover (escapes overflow containers) -->
  {#if variancePopover}
    <button
      class="fixed inset-0 z-[--z-overlay] cursor-default"
      aria-label="Close popover"
      onclick={hideVariance}
    ></button>
    <div
      class="fixed z-[--z-modal] rounded-[--radius-md] border border-border-subtle bg-bg-card shadow-lg px-3 py-2 min-w-[140px] w-max max-w-[240px]"
      style="left: {variancePopover.x}px; top: {variancePopover.flipUp ? 'auto' : `${variancePopover.y}px`}; bottom: {variancePopover.flipUp ? `${window.innerHeight - variancePopover.y + 4}px` : 'auto'}"
      role="tooltip"
    >
      {#each variancePopover.variants as variant (variant.systemLabel)}
        <span class="block text-[11px] leading-relaxed text-text-muted">
          <span class="font-semibold text-text-secondary">{variant.systemLabel}:</span> {variant.description}
        </span>
      {/each}
    </div>
  {/if}
</main>
