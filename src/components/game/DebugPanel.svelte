<!-- Bidding-phase suggested-bid display only. For full debug drawer, see DebugDrawer.svelte. -->
<script lang="ts">
  import { getGameStore } from "../../stores/context";
  import { formatCall } from "../../display/format";

  const gameStore = getGameStore();

  const suggestion = $derived(gameStore.getExpectedBid());
  const siblings = $derived(suggestion?.treePath?.siblings ?? []);
</script>

<div
  class="bg-yellow-900/90 text-yellow-100 text-xs font-mono px-3 py-2 rounded border border-dashed border-yellow-500/60 shadow-lg"
>
  <div class="text-yellow-400/80 font-semibold mb-1">DEV: Correct Bid</div>
  {#if suggestion}
    <div class="mt-0.5">
      <!-- Matched bid (correct) -->
      <div class="flex items-baseline gap-1">
        <span class="text-sm font-bold text-green-300">{formatCall(suggestion.call)}</span>
        {#if suggestion.meaning}
          <span class="text-yellow-300/70">— {suggestion.meaning}</span>
        {/if}
      </div>
      <!-- All other bids at this decision point -->
      {#if siblings.length > 0}
        <div class="text-yellow-400/60 mt-1">Other bids:</div>
      {/if}
      {#each siblings as sibling (sibling.bidName)}
        <div class="flex items-baseline gap-1 text-yellow-200/50">
          <span class="font-bold">{formatCall(sibling.call)}</span>
          <span class="text-yellow-300/40">— {sibling.meaning}</span>
        </div>
      {/each}
    </div>
  {:else}
    <span class="text-yellow-300/50 italic">No convention bid (pass)</span>
  {/if}
</div>
