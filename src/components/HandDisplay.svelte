<script lang="ts">
  import type { Hand, Card } from "../engine/types";
  import { Suit } from "../engine/types";
  import { SUIT_ORDER, RANK_INDEX } from "../engine/constants";
  import { SUIT_SYMBOLS } from "../lib/format";

  interface Props {
    hand: Hand;
    visible?: boolean;
  }

  let { hand, visible = true }: Props = $props();

  const groupedBySuit = $derived(
    SUIT_ORDER.map((suit) => ({
      suit,
      symbol: SUIT_SYMBOLS[suit],
      color: suit === Suit.Hearts || suit === Suit.Diamonds ? "text-red-500" : "text-gray-200",
      cards: hand.cards
        .filter((c: Card) => c.suit === suit)
        .sort((a: Card, b: Card) => RANK_INDEX[b.rank] - RANK_INDEX[a.rank]),
    })),
  );
</script>

<div class="space-y-1 font-mono text-lg">
  {#if visible}
    {#each groupedBySuit as group (group.suit)}
      <div class="flex items-center gap-1">
        <span class={group.color + " font-bold w-5 text-center"}>{group.symbol}</span>
        <span class="text-gray-300">
          {#each group.cards as card (card.suit + card.rank)}
            {card.rank + " "}
          {/each}
          {#if group.cards.length === 0}
            <span class="text-gray-600">—</span>
          {/if}
        </span>
      </div>
    {/each}
  {:else}
    <div class="text-gray-500 italic">Hidden</div>
  {/if}
</div>
