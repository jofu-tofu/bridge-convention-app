<script lang="ts">
  import type { Call } from "../../../engine/types";
  import type { Seat, Hand, Auction } from "../../../engine/types";
  import type { ConventionConfig } from "../../../conventions/types";
  import type { BidFeedback } from "../../../stores/game.svelte";
  import BidPanel from "../../game/BidPanel.svelte";
  import BidFeedbackPanel from "../../game/BidFeedbackPanel.svelte";
  import DebugPanel from "../../game/DebugPanel.svelte";

  interface Props {
    legalCalls: Call[];
    onBid: (call: Call) => void;
    disabled: boolean;
    isUserTurn: boolean;
    bidFeedback: BidFeedback | null;
    isFeedbackBlocking: boolean;
    onDismissFeedback: () => void;
    onSkipToReview: () => void;
    /** DEV-only props for debug panel */
    convention?: ConventionConfig | null;
    hand?: Hand;
    auction?: Auction;
    seat?: Seat;
  }

  let {
    legalCalls,
    onBid,
    disabled,
    isUserTurn,
    bidFeedback,
    isFeedbackBlocking,
    onDismissFeedback,
    onSkipToReview,
    convention,
    hand,
    auction,
    seat,
  }: Props = $props();

  const DEV = import.meta.env.DEV;
</script>

<div>
  <h2 class="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider" aria-live="polite">
    {#if bidFeedback}
      Your bid
    {:else if isUserTurn}
      Your bid
    {:else}
      Waiting...
    {/if}
  </h2>
  <BidPanel
    {legalCalls}
    {onBid}
    {disabled}
    compact
  />
</div>
{#if bidFeedback}
  <BidFeedbackPanel
    feedback={bidFeedback}
    onContinue={onDismissFeedback}
    {onSkipToReview}
  />
{/if}
{#if DEV && convention && hand && auction && seat && !bidFeedback}
  <div class="mt-auto">
    <DebugPanel
      {convention}
      {hand}
      {auction}
      {seat}
    />
  </div>
{/if}
