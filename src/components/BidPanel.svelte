<script lang="ts">
  import type { Call } from "../engine/types";
  import { BidSuit } from "../engine/types";
  import { formatCall, suitColor } from "../lib/format";

  interface Props {
    legalCalls: Call[];
    onBid: (call: Call) => void;
    disabled?: boolean;
  }

  let { legalCalls, onBid, disabled = false }: Props = $props();

  function callSortKey(call: Call): number {
    if (call.type !== "bid") {
      if (call.type === "pass") return 0;
      if (call.type === "double") return 1000;
      return 1001; // redouble
    }
    const strainOrder: Record<BidSuit, number> = { C: 0, D: 1, H: 2, S: 3, NT: 4 };
    return call.level * 10 + strainOrder[call.strain];
  }

  const sortedCalls = $derived(
    [...legalCalls].sort((a, b) => callSortKey(a) - callSortKey(b)),
  );

  function getCallColor(call: Call): string {
    if (call.type !== "bid") return "";
    if (call.strain === BidSuit.Hearts || call.strain === BidSuit.Diamonds) {
      return "text-red-400";
    }
    return "";
  }
</script>

<div class="flex flex-wrap gap-2">
  {#each sortedCalls as call (callSortKey(call))}
    <button
      class="px-3 py-2 rounded font-mono text-sm transition-colors
        {disabled
          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
          : 'bg-gray-700 hover:bg-gray-600 text-gray-200 cursor-pointer'
        } {getCallColor(call)}"
      disabled={disabled}
      onclick={() => onBid(call)}
    >
      {formatCall(call)}
    </button>
  {/each}
  {#if sortedCalls.length === 0}
    <span class="text-gray-500 italic">No legal calls</span>
  {/if}
</div>
