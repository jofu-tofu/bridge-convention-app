<!-- Design: Always show all 35 bids in a stable 7x5 grid. Unavailable bids are
     grayed out (disabled) rather than hidden, so the table structure stays constant
     across auction states. This is a deliberate UX choice, not a bug. -->
<script lang="ts">
  import type { Call, ContractBid } from "../../engine/types";
  import { BidSuit } from "../../engine/types";
  import { formatCall } from "../../core/display/format";
  import { callKey } from "../../engine/call-helpers";
  import { BID_SUIT_COLOR_CLASS } from "../../core/display/tokens";

  interface Props {
    legalCalls: Call[];
    onBid: (call: Call) => void;
    disabled?: boolean;
    compact?: boolean;
  }

  let {
    legalCalls,
    onBid,
    disabled = false,
    compact = false,
  }: Props = $props();

  const STRAINS = [
    BidSuit.Clubs,
    BidSuit.Diamonds,
    BidSuit.Hearts,
    BidSuit.Spades,
    BidSuit.NoTrump,
  ] as const;
  const ALL_BIDS: readonly ContractBid[] = Array.from(
    { length: 35 },
    (_, i) => ({
      type: "bid" as const,
      level: (Math.floor(i / 5) + 1) as ContractBid["level"],
      strain: STRAINS[i % 5]!,
    }),
  );

  const ALL_SPECIALS: Call[] = [
    { type: "pass" },
    { type: "double" },
    { type: "redouble" },
  ];

  const legalSet = $derived(new Set(legalCalls.map(callKey)));

  function isLegal(call: Call): boolean {
    return legalSet.has(callKey(call));
  }

  function getColorClass(call: Call): string {
    if (call.type !== "bid") return "text-text-primary";
    return BID_SUIT_COLOR_CLASS[call.strain] ?? "text-text-primary";
  }
</script>

<div class="flex flex-col {compact ? 'gap-1' : 'gap-2'} min-w-0">
  <div
    class="grid grid-cols-5 gap-0.5"
    aria-label="Contract bids"
    data-testid="level-bids"
  >
    {#each ALL_BIDS as call (callKey(call))}
      {@const legal = isLegal(call) && !disabled}
      <button
        data-testid="bid-{callKey(call)}"
        class="{compact
          ? 'px-0.5 py-1 text-[--text-label]'
          : 'px-1 py-2.5 text-[--text-detail]'} {compact ? '' : 'min-h-[--size-touch-target]'} rounded-[--radius-sm] font-mono transition-colors bg-bg-elevated text-center
          {legal
          ? 'hover:bg-bg-hover cursor-pointer'
          : 'opacity-30 cursor-default'} {getColorClass(call)}"
        disabled={!legal}
        onclick={() => onBid(call)}
      >
        {formatCall(call)}
      </button>
    {/each}
  </div>

  <div class="flex gap-0.5" aria-label="Special bids" data-testid="special-bids">
    {#each ALL_SPECIALS as call (callKey(call))}
      {@const legal = isLegal(call) && !disabled}
      <button
        data-testid="bid-{callKey(call)}"
        class="flex-1 {compact
          ? 'px-1 py-1 text-[--text-label]'
          : 'px-2 py-2.5 text-[--text-detail]'} {compact ? '' : 'min-h-[--size-touch-target]'} rounded-[--radius-sm] font-mono transition-colors bg-bg-elevated text-text-primary text-center
          {legal
          ? 'hover:bg-bg-hover cursor-pointer'
          : 'opacity-30 cursor-default'}"
        disabled={!legal}
        onclick={() => onBid(call)}
      >
        {formatCall(call)}
      </button>
    {/each}
  </div>
</div>
