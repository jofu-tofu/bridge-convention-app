<script lang="ts">
  import type { Call } from "../../../engine/types";
  import type { ViewportBidFeedback, TeachingDetail } from "../../../core/viewport";
  import BidPanel from "../../game/BidPanel.svelte";
  import BidFeedbackPanel from "../../game/bid-feedback/BidFeedbackPanel.svelte";
  interface Props {
    legalCalls: Call[];
    onBid: (call: Call) => void;
    disabled: boolean;
    isUserTurn: boolean;
    isFeedbackBlocking: boolean;
    onRetry: () => void;
    viewportFeedback: ViewportBidFeedback | null;
    teachingDetail: TeachingDetail | null;
  }

  let {
    legalCalls,
    onBid,
    disabled,
    isUserTurn,
    isFeedbackBlocking: _isFeedbackBlocking,
    onRetry,
    viewportFeedback,
    teachingDetail,
  }: Props = $props();

  const hasFeedback = $derived(viewportFeedback !== null);
</script>

<div class="min-w-0 min-h-0 flex-1 overflow-y-auto">
  <h2
    class="text-[--text-label] font-medium text-text-muted mb-2 uppercase tracking-wider"
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
  <div class="mt-3" class:hidden={!hasFeedback}>
    {#if viewportFeedback}
      <BidFeedbackPanel
        feedback={viewportFeedback}
        teaching={teachingDetail}
        {onRetry}
      />
    {/if}
  </div>
</div>
