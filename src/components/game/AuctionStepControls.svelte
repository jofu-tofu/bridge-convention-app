<script lang="ts">
  interface Props {
    selectedBidStep: number | null;
    totalBids: number;
    onSelectBidStep: (step: number | null) => void;
  }

  const { selectedBidStep, totalBids, onSelectBidStep }: Props = $props();

  const isStepping = $derived(selectedBidStep !== null);
  const atStart = $derived(selectedBidStep !== null && selectedBidStep <= 0);
  const atEnd = $derived(selectedBidStep !== null && selectedBidStep >= totalBids);

  const positionLabel = $derived.by(() => {
    if (selectedBidStep === null) return "All bids";
    if (selectedBidStep === 0) return "Start";
    return `Bid ${selectedBidStep}/${totalBids}`;
  });

  function stepBack() {
    if (selectedBidStep !== null && selectedBidStep > 0) {
      onSelectBidStep(selectedBidStep - 1);
    }
  }

  function stepForward() {
    if (selectedBidStep !== null && selectedBidStep < totalBids) {
      onSelectBidStep(selectedBidStep + 1);
    }
  }

  function toggleStepping() {
    if (isStepping) {
      onSelectBidStep(null);
    } else {
      onSelectBidStep(0);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isStepping) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepBack();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      stepForward();
    } else if (e.key === "Home") {
      e.preventDefault();
      onSelectBidStep(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onSelectBidStep(totalBids);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onSelectBidStep(null);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="flex items-center gap-2 bg-bg-card border border-border-subtle rounded-[--radius-lg] px-3 py-1.5 shadow-sm"
  role="toolbar"
  aria-label="Auction step controls"
>
  {#if isStepping}
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="step-btn"
        onclick={() => onSelectBidStep(0)}
        disabled={atStart}
        aria-label="Jump to start"
        title="Jump to start"
      >&#x25C1;&#x25C1;</button>
      <button
        type="button"
        class="step-btn"
        onclick={stepBack}
        disabled={atStart}
        aria-label="Previous bid"
        title="Previous bid"
      >&#x25C1;</button>
      <button
        type="button"
        class="step-btn"
        onclick={stepForward}
        disabled={atEnd}
        aria-label="Next bid"
        title="Next bid"
      >&#x25B7;</button>
      <button
        type="button"
        class="step-btn"
        onclick={() => onSelectBidStep(totalBids)}
        disabled={atEnd}
        aria-label="Jump to end"
        title="Jump to end"
      >&#x25B7;&#x25B7;</button>
    </div>
  {/if}

  <span class="text-[--text-detail] text-text-secondary flex-1 text-center truncate">
    {positionLabel}
  </span>

  <button
    type="button"
    class="text-[--text-detail] font-medium px-2 py-0.5 rounded-[--radius-md] transition-colors shrink-0
      {isStepping
        ? 'text-accent-primary hover:text-accent-primary-hover hover:bg-bg-elevated'
        : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'}"
    onclick={toggleStepping}
    aria-label={isStepping ? "Show all bids" : "Step through bids"}
    title={isStepping ? "Show all bids" : "Step through bids"}
  >
    {isStepping ? "Show All" : "Step Through"}
  </button>
</div>

<style>
  .step-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--size-touch-target);
    min-height: var(--size-touch-target);
    padding: 0 0.25rem;
    font-size: var(--text-detail);
    color: var(--color-text-secondary);
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: color 0.15s, background-color 0.15s;
  }
  .step-btn:hover:not(:disabled) {
    color: var(--color-text-primary);
    background-color: var(--color-bg-elevated);
  }
  .step-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
</style>
