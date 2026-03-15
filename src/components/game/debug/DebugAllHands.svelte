<script lang="ts">
  import { Suit } from "../../../engine/types";
  import type { Seat, Deal } from "../../../engine/types";
  import { calculateHcp } from "../../../engine/hand-evaluator";
  import { formatSuitCards } from "./debug-helpers";

  interface Props {
    deal: Deal | null;
    allSeats: readonly Seat[];
  }

  let { deal, allSeats }: Props = $props();
</script>

<details>
  <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">All Hands</summary>
  <div class="pl-2 py-1">
    {#if deal}
      {#each allSeats as seat (seat)}
        <div class="mb-2">
          <div class="font-semibold text-text-primary">
            {seat}
            <span class="text-text-muted font-normal">({calculateHcp(deal.hands[seat])} HCP)</span>
          </div>
          <div class="pl-2">
            {#each [{ suit: Suit.Spades, sym: "\u2660" }, { suit: Suit.Hearts, sym: "\u2665" }, { suit: Suit.Diamonds, sym: "\u2666" }, { suit: Suit.Clubs, sym: "\u2663" }] as { suit, sym } (suit)}
              <div>
                <span class={suit === Suit.Hearts || suit === Suit.Diamonds ? "text-red-400" : "text-text-primary"}>{sym}</span>
                {formatSuitCards(deal.hands[seat].cards, suit)}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</details>
