<script lang="ts">
  import type { Call } from "../../engine/types";
  import { BidSuit } from "../../engine/types";
  import { formatCall } from "../../lib/format";
  import { BID_SUIT_COLOR_CLASS } from "../../lib/tokens";

  interface Props {
    legalCalls: Call[];
    onBid: (call: Call) => void;
    disabled?: boolean;
    compact?: boolean;
  }

  let { legalCalls, onBid, disabled = false, compact = false }: Props = $props();

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

  const levelBids = $derived(sortedCalls.filter((c) => c.type === "bid"));
  const specialBids = $derived(sortedCalls.filter((c) => c.type !== "bid"));

  function getColorClass(call: Call): string {
    if (call.type !== "bid") return "text-text-primary";
    return BID_SUIT_COLOR_CLASS[call.strain] ?? "text-text-primary";
  }
</script>

<div class="space-y-2">
  <div class="grid grid-cols-5 gap-1" data-testid="level-bids">
    {#each levelBids as call (callSortKey(call))}
      <button
        class="{compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} rounded-[--radius-sm] font-mono transition-colors
          {disabled
            ? 'bg-bg-elevated text-text-muted'
            : 'bg-bg-elevated hover:bg-bg-hover cursor-pointer'
          } {getColorClass(call)}"
        disabled={disabled}
        onclick={() => onBid(call)}
      >
        {formatCall(call)}
      </button>
    {/each}
  </div>

  <div class="flex gap-1" data-testid="special-bids">
    {#each specialBids as call (callSortKey(call))}
      <button
        class="{compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} rounded-[--radius-sm] font-mono transition-colors
          {disabled
            ? 'bg-bg-elevated text-text-muted'
            : 'bg-bg-elevated hover:bg-bg-hover text-text-primary cursor-pointer'
          }"
        disabled={disabled}
        onclick={() => onBid(call)}
      >
        {formatCall(call)}
      </button>
    {/each}
  </div>

  {#if sortedCalls.length === 0}
    <span class="text-text-muted italic text-sm">No legal calls</span>
  {/if}
</div>
