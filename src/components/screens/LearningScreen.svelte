<script lang="ts">
  import { getAppStore } from "../../stores/context";
  import { listConventions } from "../../conventions/core";
  import type { ConventionConfig, ConventionTeaching } from "../../conventions/core";
  import { filterConventions } from "../../core/display/filter-conventions";
  import { DESKTOP_MIN } from "../../core/display/breakpoints.svelte";

  const appStore = getAppStore();

  let searchQuery = $state("");
  let depthMode = $state<"compact" | "study" | "learn">("study");
  let headerCollapsed = $state(false);
  let innerW = $state(1024);
  let sidebarOpen = $state(false);

  const isDesktop = $derived(innerW >= DESKTOP_MIN);

  const config = $derived(appStore.learningConvention);

  const filteredConventions = $derived(
    filterConventions(listConventions(), searchQuery, null),
  );

  const conventionTeaching = $derived<ConventionTeaching | null>(
    config?.teaching ?? null,
  );

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
            {conv.name}
          </button>
        {/each}
      </nav>
    </aside>
    {/if}

    <!-- Main content -->
    <div class="flex-1 flex flex-col min-h-0">
      {#if config}
        <!-- Convention toolbar — always visible -->
        <div class="shrink-0 px-4 sm:px-8 py-3 border-b border-border-subtle bg-bg-base flex flex-col gap-2">
          <div class="flex items-center gap-3 min-w-0">
            <h1 class="text-xl font-semibold text-text-primary truncate min-w-0 flex-1">{config.name}</h1>
            <span class="shrink-0 rounded-full bg-bg-hover text-text-secondary text-xs font-medium px-3 py-1">
              {config.category}
            </span>
          </div>
          <div class="flex items-center gap-3 flex-wrap">
            <!-- Depth mode tabs -->
            <div class="flex gap-1 bg-[#1c2530] rounded-[--radius-md] p-1" role="tablist" aria-label="Detail level">
              {#each [
                { mode: "compact" as const, label: "Compact" },
                { mode: "study" as const, label: "Study" },
                { mode: "learn" as const, label: "Learn" },
              ] as tab (tab.mode)}
                <button
                  role="tab"
                  aria-selected={depthMode === tab.mode}
                  class="px-3 py-1.5 text-sm rounded-[--radius-md] transition-colors cursor-pointer
                    {depthMode === tab.mode
                      ? 'bg-accent-primary text-text-on-accent font-medium'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}"
                  onclick={() => depthMode = tab.mode}
                >
                  {tab.label}
                </button>
              {/each}
            </div>
            <button
              class="shrink-0 px-5 py-2.5 bg-accent-primary text-text-on-accent rounded-[--radius-md] text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer min-h-[--size-touch-target]"
              onclick={() => config && appStore.selectConvention(config)}
            >
              Practice
            </button>
          </div>
        </div>

        <!-- Scrollable content -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-8 space-y-7">
          <!-- About This Convention card -->
          <section class="bg-[#1c2530] rounded-[--radius-lg] border border-border-subtle">
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
                <div>
                  <span class="text-xs font-semibold text-slate-400 uppercase tracking-wide">Summary</span>
                  <p class="text-sm text-slate-200 mt-1">{config.description}</p>
                </div>
                {#if conventionTeaching && depthMode !== "compact"}
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
                {/if}
              </div>
            {/if}
          </section>

          <hr class="border-border-subtle" />

          <!-- Quick Reference: common bidding decisions for this convention -->
          {#if config}
            <section class="bg-bg-card rounded-[--radius-lg] p-5 border border-border-subtle">
              <h3 class="text-base font-semibold text-text-primary mb-3">Quick Reference</h3>
              {#if config.id === "nt-bundle" || config.id === "stayman" || config.id === "jacoby-transfers"}
                <div class="space-y-3 text-sm text-text-secondary leading-relaxed">
                  <div>
                    <h4 class="font-medium text-text-primary mb-1">After partner opens 1NT (15-17 HCP):</h4>
                    <ul class="list-disc ml-5 space-y-1">
                      <li><span class="font-mono text-text-primary">Pass</span> — 0-7 HCP, no 5-card major</li>
                      <li><span class="font-mono text-suit-clubs">2♣</span> (Stayman) — 8+ HCP with a 4-card major, no 5-card major</li>
                      <li><span class="font-mono text-suit-diamonds">2♦</span> (Transfer) — 5+ hearts, any HCP</li>
                      <li><span class="font-mono text-suit-hearts">2♥</span> (Transfer) — 5+ spades, any HCP</li>
                      <li><span class="font-mono text-text-primary">2NT</span> — 8-9 HCP, no 4-card major, no 5-card major (invitational)</li>
                      <li><span class="font-mono text-text-primary">3NT</span> — 10-15 HCP, no 4-card major, no 5-card major (game)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 class="font-medium text-text-primary mb-1">Key principles:</h4>
                    <ul class="list-disc ml-5 space-y-1">
                      <li>With 5+ in a major, always transfer (even with a 4-card major in the other suit)</li>
                      <li>Stayman requires both a 4-card major AND 8+ HCP</li>
                      <li>Responder is captain — opener describes, responder decides</li>
                    </ul>
                  </div>
                  <div>
                    <h4 class="font-medium text-text-primary mb-1">Alerts & Announcements:</h4>
                    <ul class="list-disc ml-5 space-y-1">
                      <li><span class="font-mono text-text-primary">1NT</span> — Partner announces "15 to 17"</li>
                      <li><span class="font-mono text-suit-clubs">2♣</span> (Stayman) — Not alerted (standard)</li>
                      <li><span class="font-mono"><span class="text-suit-diamonds">2♦</span>/<span class="text-suit-hearts">2♥</span></span> (Transfer) — Partner announces "Transfer"</li>
                    </ul>
                  </div>
                </div>
              {:else}
                <p class="text-text-muted italic">
                  Detailed bidding guide coming soon.
                </p>
              {/if}
            </section>
          {/if}
        </div>
      {:else}
        <div class="text-center py-12 text-text-muted">
          Select a convention from the sidebar.
        </div>
      {/if}
    </div>
  </div>
</main>
