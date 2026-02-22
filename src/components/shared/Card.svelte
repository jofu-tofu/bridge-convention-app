<script lang="ts">
  import type { Card as CardType } from "../../engine/types";
  import { SUIT_CARD_COLOR_CLASS } from "../../lib/tokens";
  import { SUIT_SYMBOLS } from "../../lib/format";

  interface Props {
    card: CardType;
    faceUp?: boolean;
    clickable?: boolean;
    onclick?: () => void;
    /** When true, show rank/suit at bottom only (readable from across the table) */
    mirrored?: boolean;
  }

  let {
    card,
    faceUp = true,
    clickable = false,
    onclick,
    mirrored = false,
  }: Props = $props();

  const colorClass = $derived(SUIT_CARD_COLOR_CLASS[card.suit]);
  const symbol = $derived(SUIT_SYMBOLS[card.suit]);
  const cardStyle = "width: var(--card-width); height: var(--card-height);";
  const hoverClass = $derived(
    mirrored
      ? "motion-safe:hover:translate-y-1 hover:shadow-lg cursor-pointer motion-safe:transition-transform"
      : "motion-safe:hover:-translate-y-1 hover:shadow-lg cursor-pointer motion-safe:transition-transform",
  );
</script>

{#snippet cardFace()}
  {#if mirrored}
    <!-- Mirrored: text at bottom-left only, readable from across the table -->
    <span
      class="absolute bottom-1 left-1.5 text-xs font-bold leading-none {colorClass}"
    >
      {card.rank}<br />{symbol}
    </span>
  {:else}
    <!-- Normal: top-left upright + bottom-right rotated 180° -->
    <span
      class="absolute top-1 left-1.5 text-xs font-bold leading-none {colorClass}"
    >
      {card.rank}<br />{symbol}
    </span>
    <span
      class="absolute bottom-1 right-1.5 text-xs font-bold leading-none {colorClass}"
      style="transform: rotate(180deg);"
    >
      {card.rank}<br />{symbol}
    </span>
  {/if}
{/snippet}

{#if faceUp && clickable}
  <button
    type="button"
    class="relative bg-card-face rounded-[--radius-md] shadow-md select-none
      {hoverClass}
      border-none p-0"
    style={cardStyle}
    {onclick}
    aria-label="{card.rank} of {card.suit}"
    data-testid="card"
    data-suit={card.suit}
  >
    {@render cardFace()}
  </button>
{:else if faceUp}
  <div
    class="relative bg-card-face rounded-[--radius-md] shadow-md select-none"
    style={cardStyle}
    aria-label="{card.rank} of {card.suit}"
    data-testid="card"
    data-suit={card.suit}
  >
    {@render cardFace()}
  </div>
{:else}
  <div
    class="rounded-[--radius-md] bg-card-back border border-card-back-border"
    style={cardStyle}
    aria-label="Card back"
    data-testid="card-back"
  ></div>
{/if}
