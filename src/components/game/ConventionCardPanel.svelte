<script lang="ts">
  import type { ConventionCardPanelView, AcblCardPanelView } from "../../service";
  import { ConventionCardFormat } from "../../service";
  import { DESKTOP_MIN } from "../shared/breakpoints.svelte";
  import { SvelteSet } from "svelte/reactivity";
  import ToggleGroup from "../shared/ToggleGroup.svelte";

  interface Props {
    panelView: ConventionCardPanelView;
    acblPanelView: AcblCardPanelView;
    open: boolean;
    onclose: () => void;
  }

  let { panelView, acblPanelView, open, onclose }: Props = $props();

  let windowW = $state(typeof window !== "undefined" ? window.innerWidth : 1200);
  const isDesktop = $derived(windowW >= DESKTOP_MIN);

  let format = $state<ConventionCardFormat>(ConventionCardFormat.App);

  const expandedSections = new SvelteSet<string>();
  let allExpanded = $state(false);

  function toggleSection(id: string) {
    if (expandedSections.has(id)) {
      expandedSections.delete(id);
    } else {
      expandedSections.add(id);
    }
  }

  function toggleAll() {
    if (allExpanded) {
      expandedSections.clear();
      allExpanded = false;
    } else {
      for (const s of panelView.sections) {
        expandedSections.add(s.id);
      }
      allExpanded = true;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      onclose();
    }
  }

  function handleBackdropClick() {
    onclose();
  }

  const FORMAT_ITEMS = [
    { id: ConventionCardFormat.App, label: "App", testId: "cc-format-app" },
    { id: ConventionCardFormat.Acbl, label: "ACBL", testId: "cc-format-acbl" },
  ];
</script>

<svelte:window bind:innerWidth={windowW} onkeydown={handleKeydown} />

{#if open}
  <!-- Backdrop -->
  <button
    class="fixed inset-0 bg-black/40 z-[--z-modal] cursor-default"
    onclick={handleBackdropClick}
    aria-label="Close convention card"
    data-testid="cc-panel-backdrop"
  ></button>

  <!-- Panel -->
  <aside
    class="fixed z-[--z-above-all] bg-bg-base border-border-subtle overflow-y-auto
           {isDesktop
             ? 'inset-y-0 right-0 w-[380px] border-l'
             : 'inset-x-0 bottom-0 max-h-[70vh] rounded-t-[--radius-lg] border-t'}"
    aria-label="Convention card"
    data-testid="cc-panel"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-border-subtle sticky top-0 bg-bg-base z-[--z-overlay]">
      <div class="flex items-center gap-2 min-w-0">
        <span class="px-2 py-0.5 rounded-full text-[--text-annotation] font-semibold bg-accent-primary/20 text-accent-primary">
          {format === ConventionCardFormat.App ? panelView.systemName : acblPanelView.systemName}
        </span>
        <h2 class="text-[--text-body] font-semibold text-text-primary truncate">Convention Card</h2>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <ToggleGroup
          items={FORMAT_ITEMS}
          active={format}
          onSelect={(id) => { format = id as ConventionCardFormat; }}
          ariaLabel="Convention card format"
          compact
        />
        {#if format === ConventionCardFormat.App}
          <button
            class="text-[--text-annotation] text-text-secondary hover:text-text-primary cursor-pointer transition-colors px-2 py-1 rounded-[--radius-sm]"
            onclick={toggleAll}
            data-testid="cc-expand-all"
          >
            {allExpanded ? "Collapse All" : "Expand All"}
          </button>
        {/if}
        <button
          class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
          onclick={onclose}
          aria-label="Close convention card"
          data-testid="cc-panel-close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="px-4 py-2">
      {#if format === ConventionCardFormat.App}
        <!-- App mode: accordion sections -->
        {#each panelView.sections as section (section.id)}
          {@const isExpanded = expandedSections.has(section.id)}
          <div class="border-b border-border-subtle last:border-b-0">
            <!-- Section header (clickable) -->
            <button
              class="w-full flex items-center gap-2 py-2.5 cursor-pointer text-left"
              onclick={() => toggleSection(section.id)}
              aria-expanded={isExpanded}
            >
              <svg
                class="w-3.5 h-3.5 text-text-muted shrink-0 transition-transform duration-150"
                class:rotate-90={isExpanded}
                xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6"/>
              </svg>
              <span class="text-[--text-detail] font-semibold text-text-primary">{section.title}</span>
              {#if !isExpanded}
                <span class="text-[--text-annotation] text-text-muted truncate ml-1">{section.compactSummary}</span>
              {/if}
            </button>

            <!-- Expanded content -->
            {#if isExpanded}
              <div class="pl-5.5 pb-3">
                <!-- Line items -->
                {#if section.items.length > 0}
                  <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mb-2">
                    {#each section.items as item (item.label)}
                      <dt class="text-[--text-annotation] text-text-muted">{item.label}</dt>
                      <dd class="text-[--text-annotation] text-text-secondary">{item.value}</dd>
                    {/each}
                  </dl>
                {/if}

                <!-- Module details -->
                {#each section.modules as mod (mod.moduleId)}
                  <div class="mt-2 first:mt-0">
                    <h4 class="text-[--text-annotation] font-semibold text-accent-primary">{mod.moduleName}</h4>
                    <p class="text-[--text-annotation] text-text-secondary mt-0.5">{mod.description}</p>
                    {#if mod.principle}
                      <p class="text-[--text-annotation] text-text-muted mt-1">
                        <span class="font-medium text-text-secondary">Principle:</span> {mod.principle}
                      </p>
                    {/if}
                    {#if mod.tradeoff}
                      <p class="text-[--text-annotation] text-text-muted mt-1">
                        <span class="font-medium text-text-secondary">Tradeoff:</span> {mod.tradeoff}
                      </p>
                    {/if}
                    {#if mod.commonMistakes && mod.commonMistakes.length > 0}
                      <div class="mt-1">
                        <span class="text-[--text-annotation] font-medium text-text-secondary">Common mistakes:</span>
                        <ul class="list-disc list-inside mt-0.5">
                          {#each mod.commonMistakes as mistake (mistake)}
                            <li class="text-[--text-annotation] text-text-muted">{mistake}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      {:else}
        <!-- ACBL mode: bordered card sections, always visible -->
        <div class="flex flex-col gap-3" data-testid="acbl-card-sections">
          {#each acblPanelView.sections as section (section.id)}
            <div
              class="border rounded-[--radius-md] {section.available ? 'border-border-subtle' : 'border-border-subtle opacity-40'}"
              data-testid="acbl-section-{section.id}"
            >
              <!-- Section title bar -->
              <div class="bg-bg-raised px-3 py-1.5 border-b border-border-subtle rounded-t-[--radius-md]">
                <h3 class="text-[--text-detail] font-semibold text-text-primary">{section.title}</h3>
              </div>

              <!-- Section body -->
              <div class="px-3 py-2">
                {#if section.available}
                  {#if section.items.length > 0}
                    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                      {#each section.items as item (item.label)}
                        <dt class="text-[--text-annotation] text-text-muted">{item.label}</dt>
                        <dd class="text-[--text-annotation] text-text-secondary">{item.value}</dd>
                      {/each}
                    </dl>
                  {/if}

                  {#if section.modules.length > 0}
                    <div class="{section.items.length > 0 ? 'mt-2' : ''}">
                      {#each section.modules as mod (mod.moduleId)}
                        <span class="text-[--text-annotation] font-semibold text-accent-primary">{mod.moduleName}</span>
                        {#if mod.description}
                          <p class="text-[--text-annotation] text-text-secondary mt-0.5">{mod.description}</p>
                        {/if}
                      {/each}
                    </div>
                  {/if}

                  {#if section.items.length === 0 && section.modules.length === 0}
                    <p class="text-[--text-annotation] text-text-muted italic">No details configured</p>
                  {/if}
                {:else}
                  <p class="text-[--text-annotation] text-text-muted italic" data-testid="acbl-not-configured">Not yet configured</p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </aside>
{/if}
