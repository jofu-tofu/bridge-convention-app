<!-- Bidding-phase suggested-bid display only. For full debug drawer, see DebugDrawer.svelte. -->
<script lang="ts">
  import type { ConventionConfig } from "../../conventions/types";
  import type { Hand, Auction, Seat } from "../../engine/types";
  import { evaluateHand } from "../../lib/hcp-eval";
  import { conventionToStrategy } from "../../ai/convention-strategy";
  import { createBiddingContext } from "../../conventions/context-factory";
  import { formatCall } from "../../lib/format";

  interface Props {
    convention: ConventionConfig;
    hand: Hand;
    auction: Auction;
    seat: Seat;
  }

  let { convention, hand, auction, seat }: Props = $props();

  const suggestion = $derived.by(() => {
    const strategy = conventionToStrategy(convention);
    const evaluation = evaluateHand(hand);
    return strategy.suggest(createBiddingContext({ hand, auction, seat, evaluation }));
  });
</script>

<div
  class="bg-yellow-900/90 text-yellow-100 text-xs font-mono px-3 py-2 rounded border border-dashed border-yellow-500/60 shadow-lg"
>
  <div class="text-yellow-400/80 font-semibold mb-1">DEV: Correct Bid</div>
  {#if suggestion}
    <span class="text-sm font-bold">{formatCall(suggestion.call)}</span>
    {#if suggestion.ruleName}
      <span class="text-yellow-300/70 ml-1">({suggestion.ruleName})</span>
    {/if}
    {#if suggestion.explanation}
      <div class="mt-1 text-yellow-200/60 leading-tight">
        {suggestion.explanation}
      </div>
    {/if}
  {:else}
    <span class="text-yellow-300/50 italic">No convention bid (pass)</span>
  {/if}
</div>
