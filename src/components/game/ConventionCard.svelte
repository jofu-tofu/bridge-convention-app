<script lang="ts">
  import type { ConventionCardView } from "../../service";

  interface Props {
    cards: readonly [ConventionCardView, ConventionCardView];
  }

  let { cards }: Props = $props();
  let pinned = $state(false);

  let triggerEl = $state<HTMLButtonElement>();
  let popoverEl = $state<HTMLDivElement>();

  // Position the fixed popover below the trigger button.
  // Called on hover, click, and after mount.
  function updatePosition() {
    if (triggerEl && popoverEl) {
      const rect = triggerEl.getBoundingClientRect();
      popoverEl.style.left = `${rect.left}px`;
      popoverEl.style.top = `${rect.bottom + 4}px`;
    }
  }

  // Initialize position once both elements are bound
  $effect(() => {
    if (triggerEl && popoverEl) updatePosition();
  });
</script>

<div class="cc-wrapper relative inline-block" role="group">
  <button
    bind:this={triggerEl}
    class="px-1.5 py-0.5 text-[--text-annotation] font-bold tracking-wide
           bg-bg-card border border-border-subtle rounded-[--radius-sm]
           text-text-secondary hover:text-text-primary hover:border-accent-primary
           cursor-pointer transition-colors"
    class:border-accent-primary={pinned}
    class:text-text-primary={pinned}
    aria-label="Convention card"
    aria-expanded={pinned}
    onclick={() => { pinned = !pinned; }}
    onmouseenter={updatePosition}
    data-testid="convention-card-trigger"
  >
    CC
  </button>

  <div
    bind:this={popoverEl}
    class="cc-popover min-w-[16rem] max-w-[22rem] px-3 py-2
           bg-bg-card border border-border-subtle rounded-[--radius-md]
           shadow-lg transition-opacity duration-150
           opacity-0 pointer-events-none"
    class:cc-pinned={pinned}
    role="tooltip"
    data-testid="convention-card-popover"
  >
    <h3 class="text-[--text-label] font-semibold text-text-secondary uppercase tracking-wider mb-1">Convention Card</h3>
    {#each cards as card (card.partnership)}
      <div class="flex flex-col gap-0.5 mb-1 last:mb-0">
        <div class="flex items-baseline gap-2">
          <span class="text-[--text-detail] font-semibold text-text-primary">{card.partnership}</span>
          <span class="text-[--text-detail] font-medium text-accent-primary">{card.systemName}</span>
        </div>
        <div class="text-[--text-annotation] text-text-secondary flex flex-wrap gap-x-3 gap-y-0">
          <span>1NT: {card.ntRange}</span>
          <span>{card.majorLength}</span>
          <span>New suit: {card.twoLevelForcing}</span>
          <span>1NT resp: {card.oneNtResponse}</span>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  /* Hover reveal: pure CSS, no JS events needed */
  .cc-wrapper:hover .cc-popover {
    opacity: 1;
    pointer-events: auto;
  }
  /* Pinned: always visible regardless of hover */
  .cc-popover.cc-pinned {
    opacity: 1;
    pointer-events: auto;
  }
  /* Fixed positioning + high z-index to escape overflow-hidden ancestors
     and render above the CSS-transformed table area */
  .cc-popover {
    position: fixed;
    z-index: 50;
  }
</style>
