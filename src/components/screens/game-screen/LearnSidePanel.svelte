<script lang="ts">
  import Button from "../../shared/Button.svelte";
  import Spinner from "../../shared/Spinner.svelte";
  import { getGameStore } from "../../../stores/context";

  interface Props {
    currentBidIndex: number;
    totalBids: number;
    onFirst: () => void;
    onPrev: () => void;
    onNext: () => void;
    onLast: () => void;
    onNextDeal: () => void;
    onBackToMenu: () => void;
  }

  const {
    currentBidIndex,
    totalBids,
    onFirst,
    onPrev,
    onNext,
    onLast,
    onNextDeal,
    onBackToMenu,
  }: Props = $props();

  const gameStore = getGameStore();

  const atStart = $derived(currentBidIndex === 0);
  const atEnd = $derived(currentBidIndex === totalBids);

  const stepLabel = $derived.by(() => {
    if (currentBidIndex === 0) return "Ready";
    if (atEnd) return "Complete";
    return `Bid ${currentBidIndex} of ${totalBids}`;
  });
</script>

<div class="flex flex-col min-w-0 w-full min-h-0 flex-1 overflow-hidden">
  <!-- Step indicator -->
  <div class="mb-3">
    <p class="text-[--text-label] font-semibold text-text-primary">{stepLabel}</p>
    {#if totalBids > 0}
      <div class="mt-2 h-1 bg-bg-elevated rounded-full overflow-hidden">
        <div
          class="h-full bg-accent-primary rounded-full transition-all duration-200"
          style="width: {(currentBidIndex / totalBids) * 100}%"
        ></div>
      </div>
    {/if}
  </div>

  <!-- Navigation controls -->
  <div class="flex items-center gap-1 mb-2">
    <button
      type="button"
      class="px-2 py-1.5 min-h-[--size-touch-target] rounded-[--radius-md] text-[--text-body] font-medium transition-colors
        {atStart ? 'text-text-muted cursor-default' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer'}"
      disabled={atStart}
      onclick={onFirst}
      aria-label="Go to start"
      data-testid="learn-first"
    >
      &#x23EE;
    </button>
    <button
      type="button"
      class="flex-1 px-3 py-1.5 min-h-[--size-touch-target] rounded-[--radius-md] text-[--text-body] font-medium transition-colors
        {atStart ? 'text-text-muted bg-bg-elevated cursor-default' : 'text-text-primary bg-bg-elevated hover:bg-bg-hover cursor-pointer'}"
      disabled={atStart}
      onclick={onPrev}
      data-testid="learn-prev"
    >
      Prev
    </button>
    <button
      type="button"
      class="flex-1 px-3 py-1.5 min-h-[--size-touch-target] rounded-[--radius-md] text-[--text-body] font-medium transition-colors
        {atEnd ? 'text-text-muted bg-bg-elevated cursor-default' : 'text-text-on-accent bg-accent-primary hover:bg-accent-primary-hover cursor-pointer'}"
      disabled={atEnd}
      onclick={onNext}
      data-testid="learn-next"
    >
      Next
    </button>
    <button
      type="button"
      class="px-2 py-1.5 min-h-[--size-touch-target] rounded-[--radius-md] text-[--text-body] font-medium transition-colors
        {atEnd ? 'text-text-muted cursor-default' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer'}"
      disabled={atEnd}
      onclick={onLast}
      aria-label="Go to end"
      data-testid="learn-last"
    >
      &#x23ED;
    </button>
  </div>

  <p class="text-[--text-annotation] text-text-muted mb-4">Use arrow keys or Space</p>

  <!-- Spacer -->
  <div class="flex-1"></div>

  <!-- Actions -->
  <div class="flex flex-col gap-2 pt-3 shrink-0">
    <Button onclick={onNextDeal} disabled={gameStore.isTransitioning} testId="learn-next-deal">
      {#if gameStore.isTransitioning}
        <Spinner />
      {/if}
      New Deal
    </Button>
    <Button variant="secondary" onclick={onBackToMenu} testId="learn-back-to-menu">Back to Menu</Button>
  </div>
</div>
