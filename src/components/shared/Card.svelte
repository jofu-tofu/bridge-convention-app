<script lang="ts">
  import type { Card as CardType } from "../../service";
  import { SUIT_CARD_COLOR_CLASS } from "./tokens";
  import { SUIT_SYMBOLS, displayRank, formatCardLabel } from "../../service";
  import { getAppStoreOptional } from "../../stores/context";

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

  // Card is rendered only from `(app)` route consumers (HandFan, TrickArea, TrickOverlay)
  // where the app store is always provided via context. We read it through the optional
  // accessor so component-level unit tests that render <Card> without setting context
  // still see the default "ten" notation.
  const appStore = getAppStoreOptional();

  const colorClass = $derived(SUIT_CARD_COLOR_CLASS[card.suit]);
  const symbol = $derived(SUIT_SYMBOLS[card.suit]);
  const rank = $derived(displayRank(card.rank, appStore?.displaySettings.tenNotation ?? "ten"));
  const cardLabel = $derived(formatCardLabel(card.rank, card.suit));
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
      class="absolute bottom-1 left-1.5 font-bold leading-none {colorClass}" style="font-size: var(--text-value);"
    >
      {rank}<br />{symbol}
    </span>
  {:else}
    <!-- Normal: top-left upright + bottom-right rotated 180° -->
    <span
      class="absolute top-1 left-1.5 font-bold leading-none {colorClass}" style="font-size: var(--text-value);"
    >
      {rank}<br />{symbol}
    </span>
  {/if}
{/snippet}

{#if faceUp && clickable}
  <button
    type="button"
    class="relative bg-card-face rounded-[--radius-md] shadow-md select-none ring-1 ring-black/8
      {hoverClass}
      border-none p-0"
    style={cardStyle}
    {onclick}
    aria-label={cardLabel}
    data-testid="card"
    data-suit={card.suit}
  >
    {@render cardFace()}
  </button>
{:else if faceUp}
  <div
    class="relative bg-card-face rounded-[--radius-md] shadow-md select-none ring-1 ring-black/8"
    style={cardStyle}
    aria-label={cardLabel}
    data-testid="card"
    data-suit={card.suit}
  >
    {@render cardFace()}
  </div>
{:else}
  <div
    class="rounded-[--radius-md] bg-card-back border border-card-back-border shadow-sm"
    style={cardStyle}
    aria-label="Card back"
    data-testid="card-back"
  ></div>
{/if}
