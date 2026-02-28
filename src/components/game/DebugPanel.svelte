<!-- Bidding-phase suggested-bid display only. For full debug drawer, see DebugDrawer.svelte. -->
<script lang="ts">
  import { getGameStore } from "../../stores/context";
  import { formatCall } from "../../display/format";
  import type { BidResult } from "../../shared/types";

  const gameStore = getGameStore();

  // WORKAROUND: $derived doesn't reliably track through store getter chains.
   
  let suggestion = $state.raw<BidResult | null>(null);
  $effect(() => {
    suggestion = gameStore.getExpectedBid();
  });
</script>

<div
  class="bg-yellow-900/90 text-yellow-100 text-xs font-mono px-3 py-2 rounded border border-dashed border-yellow-500/60 shadow-lg"
>
  <div class="text-yellow-400/80 font-semibold mb-1">DEV: Correct Bid</div>
  {#if suggestion}
    <div class="flex items-baseline gap-1 mt-0.5">
      <span class="text-sm font-bold text-green-300">{formatCall(suggestion.call)}</span>
      {#if suggestion.meaning}
        <span class="text-yellow-300/70">— {suggestion.meaning}</span>
      {/if}
    </div>
  {:else}
    <span class="text-yellow-300/50 italic">No convention bid (pass)</span>
  {/if}
</div>
