<script lang="ts">
  import type { Call } from "../../../engine/types";
  import type { BidFeedback } from "../../../stores/game.svelte";
  import { getGameStore } from "../../../stores/context";
  import BidPanel from "../../game/BidPanel.svelte";
  import BidFeedbackPanel from "../../game/BidFeedbackPanel.svelte";
  import DebugPanel from "../../game/DebugPanel.svelte";

  interface Props {
    legalCalls: Call[];
    onBid: (call: Call) => void;
    disabled: boolean;
    isUserTurn: boolean;
    isFeedbackBlocking: boolean;
    onDismissFeedback: () => void;
    onSkipToReview: () => void;
    onRetry?: () => void;
  }

  let {
    legalCalls,
    onBid,
    disabled,
    isUserTurn,
    isFeedbackBlocking,
    onDismissFeedback,
    onSkipToReview,
    onRetry,
  }: Props = $props();

  const DEV = import.meta.env.DEV;

  // WORKAROUND: Svelte 5 $derived doesn't reliably track through store
  // getter chains after async operations. Using $effect for eager tracking
  // and class:hidden instead of {#if} to keep elements in the DOM.
  const gameStore = getGameStore();
   
  let bidFeedback = $state.raw<BidFeedback | null>(null);
  $effect(() => {
    bidFeedback = gameStore.bidFeedback;
  });
  const hasFeedback = $derived(bidFeedback !== null);
</script>

<div class="min-w-0 shrink-0">
  <h2
    class="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider"
    aria-live="polite"
  >
    {#if hasFeedback}
      Your bid
    {:else if isUserTurn}
      Your bid
    {:else}
      Waiting...
    {/if}
  </h2>
  <BidPanel {legalCalls} {onBid} {disabled} compact />
</div>
<div class:hidden={!hasFeedback}>
  {#if bidFeedback}
    <BidFeedbackPanel
      feedback={bidFeedback}
      onContinue={onDismissFeedback}
      {onSkipToReview}
      {onRetry}
    />
  {/if}
</div>
{#if DEV}
  <div class="mt-auto shrink-0" class:hidden={hasFeedback}>
    <DebugPanel />
  </div>
{/if}
