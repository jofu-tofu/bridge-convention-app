<!-- Bidding-phase suggested-bid display only. For full debug drawer, see DebugDrawer.svelte. -->
<script lang="ts">
  import { getGameStore } from "../../stores/context";
  import { formatCall } from "../../display/format";

  const gameStore = getGameStore();

  const suggestion = $derived(gameStore.getExpectedBid());
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
