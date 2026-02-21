<script lang="ts">
  import type { Card as CardType } from "../../engine/types";
  import { SUIT_CARD_COLOR_CLASS } from "../../lib/tokens";
  import { SUIT_SYMBOLS } from "../../lib/format";

  interface Props {
    card: CardType;
    faceUp?: boolean;
    clickable?: boolean;
    onclick?: () => void;
  }

  let { card, faceUp = true, clickable = false, onclick }: Props = $props();

  const colorClass = $derived(SUIT_CARD_COLOR_CLASS[card.suit]);
  const symbol = $derived(SUIT_SYMBOLS[card.suit]);
  const cardStyle = "width: var(--card-width); height: var(--card-height);";
</script>

{#snippet cardFace()}
  <span class="absolute top-1 left-1.5 text-xs font-bold leading-none {colorClass}">
    {card.rank}<br>{symbol}
  </span>
  <span class="absolute bottom-1 right-1.5 text-xs font-bold leading-none {colorClass}" style="transform: rotate(180deg);">
    {card.rank}<br>{symbol}
  </span>
{/snippet}

{#if faceUp && clickable}
  <button
    type="button"
    class="relative bg-white rounded-[--radius-md] shadow-md select-none
      hover:-translate-y-1 hover:shadow-lg cursor-pointer transition-transform
      border-none p-0"
    style={cardStyle}
    onclick={onclick}
    aria-label="{card.rank} of {card.suit}"
    data-testid="card"
    data-suit={card.suit}
  >
    {@render cardFace()}
  </button>
{:else if faceUp}
  <div
    class="relative bg-white rounded-[--radius-md] shadow-md select-none"
    style={cardStyle}
    data-testid="card"
    data-suit={card.suit}
  >
    {@render cardFace()}
  </div>
{:else}
  <div
    class="rounded-[--radius-md] bg-card-back border border-card-back-border"
    style={cardStyle}
    data-testid="card-back"
  ></div>
{/if}
