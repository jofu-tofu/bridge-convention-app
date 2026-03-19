<script lang="ts">
  import { Suit } from "../../../engine/types";
  import type { Seat, Deal } from "../../../engine/types";
  import { calculateHcp } from "../../../engine/hand-evaluator";
  import { formatSuitCards } from "./debug-helpers";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    deal: Deal | null;
    allSeats: readonly Seat[];
  }

  let { deal, allSeats }: Props = $props();

  const SUITS = [
    { suit: Suit.Spades, sym: "\u2660", color: "text-text-primary" },
    { suit: Suit.Hearts, sym: "\u2665", color: "text-red-400" },
    { suit: Suit.Diamonds, sym: "\u2666", color: "text-red-400" },
    { suit: Suit.Clubs, sym: "\u2663", color: "text-text-primary" },
  ] as const;
</script>

<DebugSection title="All Hands">
  {#if deal}
    <div class="space-y-0.5">
      {#each allSeats as seat (seat)}
        {@const hand = deal.hands[seat]}
        <div class="text-[10px] leading-tight">
          <span class="font-semibold text-text-primary inline-block w-5">{seat}</span>
          <span class="text-text-muted">({calculateHcp(hand)})</span>
          {#each SUITS as { suit, sym, color } (suit)}
            <span class="ml-1.5"><span class={color}>{sym}</span>{formatSuitCards(hand.cards, suit)}</span>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</DebugSection>
