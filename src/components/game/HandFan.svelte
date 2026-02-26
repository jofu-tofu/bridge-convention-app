<script lang="ts">
  import type { Card as CardType } from "../../engine/types";
  import Card from "../shared/Card.svelte";
  import { sortCards } from "../../display/sort-cards";

  interface Props {
    cards: readonly CardType[];
    faceUp?: boolean;
    vertical?: boolean;
    sorted?: boolean;
    legalPlays?: readonly CardType[];
    onPlayCard?: (card: CardType) => void;
    /** When true, card text shown at bottom only (for dummy viewed from across table) */
    mirrored?: boolean;
  }

  let {
    cards,
    faceUp = true,
    vertical = false,
    sorted = true,
    legalPlays = [],
    onPlayCard,
    mirrored = false,
  }: Props = $props();

  const displayCards = $derived(sorted ? sortCards(cards) : [...cards]);

  function isLegal(card: CardType): boolean {
    return legalPlays.some(
      (lp) => lp.suit === card.suit && lp.rank === card.rank,
    );
  }
</script>

<div
  class="hand flex {vertical ? 'flex-col' : 'flex-row'}"
  data-testid="hand-fan"
>
  {#each displayCards as card (card.suit + card.rank)}
    {@const legal = isLegal(card)}
    <div
      class="card-wrapper"
      style={vertical
        ? `margin-top: var(--card-overlap-v)`
        : `margin-left: var(--card-overlap-h)`}
    >
      <Card
        {card}
        {faceUp}
        {mirrored}
        clickable={legal && !!onPlayCard}
        onclick={legal && onPlayCard ? () => onPlayCard(card) : undefined}
      />
    </div>
  {/each}
</div>

<style>
  .card-wrapper:first-child {
    margin-left: 0 !important;
    margin-top: 0 !important;
  }
  .hand.flex-col > .card-wrapper > :global(div) {
    transform: rotate(90deg);
  }
</style>
