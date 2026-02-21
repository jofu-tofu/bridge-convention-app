<!-- Design: Always show all 35 bids in a stable 7x5 grid. Unavailable bids are
     grayed out (disabled) rather than hidden, so the table structure stays constant
     across auction states. This is a deliberate UX choice, not a bug. -->
<script lang="ts">
  import type { Call, ContractBid } from "../../engine/types";
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

  const ALL_BIDS: readonly ContractBid[] = Array.from({ length: 35 }, (_, i) => ({
    type: "bid" as const,
    level: (Math.floor(i / 5) + 1) as ContractBid["level"],
    strain: ([BidSuit.Clubs, BidSuit.Diamonds, BidSuit.Hearts, BidSuit.Spades, BidSuit.NoTrump] as const)[i % 5],
  }));

  const ALL_SPECIALS: Call[] = [
    { type: "pass" },
    { type: "double" },
    { type: "redouble" },
  ];

  function callKey(call: Call): string {
    if (call.type === "bid") return `${call.level}${call.strain}`;
    return call.type;
  }

  const legalSet = $derived(new Set(legalCalls.map(callKey)));

  function isLegal(call: Call): boolean {
    return legalSet.has(callKey(call));
  }

  function getColorClass(call: Call): string {
    if (call.type !== "bid") return "text-text-primary";
    return BID_SUIT_COLOR_CLASS[call.strain] ?? "text-text-primary";
  }
</script>

<div class="space-y-2">
  <div class="grid grid-cols-5 gap-1" data-testid="level-bids">
    {#each ALL_BIDS as call (callKey(call))}
      {@const legal = isLegal(call) && !disabled}
      <button
        class="{compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} rounded-[--radius-sm] font-mono transition-colors
          {legal
            ? 'bg-bg-elevated hover:bg-bg-hover cursor-pointer'
            : 'bg-bg-elevated opacity-30 cursor-default'
          } {getColorClass(call)}"
        disabled={!legal}
        onclick={() => onBid(call)}
      >
        {formatCall(call)}
      </button>
    {/each}
  </div>

  <div class="flex gap-1" data-testid="special-bids">
    {#each ALL_SPECIALS as call (callKey(call))}
      {@const legal = isLegal(call) && !disabled}
      <button
        class="{compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} rounded-[--radius-sm] font-mono transition-colors
          {legal
            ? 'bg-bg-elevated hover:bg-bg-hover text-text-primary cursor-pointer'
            : 'bg-bg-elevated text-text-primary opacity-30 cursor-default'
          }"
        disabled={!legal}
        onclick={() => onBid(call)}
      >
        {formatCall(call)}
      </button>
    {/each}
  </div>
</div>
