<script lang="ts">
  import type { Snippet } from "svelte";

  interface TabDef {
    id: string;
    label: string;
    content: Snippet;
  }

  interface Props {
    tabs: TabDef[];
    actions: Snippet;
    dealNumber: number;
  }

  let { tabs, actions, dealNumber }: Props = $props();

  let activeTabIndex = $state(0);

  // Reset to first tab on new deal
  $effect(() => {
    void dealNumber;
    activeTabIndex = 0;
  });
</script>

<div class="flex flex-col min-w-0 w-full min-h-0 flex-1 overflow-hidden">
<!-- Tab bar -->
<div class="flex gap-1 mb-3 shrink-0" role="tablist" aria-label="Review tabs">
  {#each tabs as tab, i (tab.id)}
    <button
      type="button"
      role="tab"
      aria-selected={activeTabIndex === i}
      aria-controls="review-panel-{tab.id}"
      class="flex-1 px-3 py-1.5 text-[--text-detail] font-medium rounded-[--radius-md] transition-colors cursor-pointer {activeTabIndex === i
        ? 'bg-bg-elevated text-text-primary'
        : 'text-text-muted hover:text-text-secondary'}"
      onclick={() => (activeTabIndex = i)}
    >
      {tab.label}
    </button>
  {/each}
</div>

<div class="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0">
  {#each [tabs[activeTabIndex]] as activeTab (activeTab?.id ?? '')}
    {#if activeTab}
      <div id="review-panel-{activeTab.id}" role="tabpanel" aria-label="{activeTab.label} review">
        {@render activeTab.content()}
      </div>
    {/if}
  {/each}
</div>

<div class="flex flex-col gap-2 pt-3 shrink-0">
  {@render actions()}
</div>
</div>
