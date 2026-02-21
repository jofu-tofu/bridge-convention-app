<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Hand, Card as CardType } from "../../engine/types";
  import { Seat } from "../../engine/types";
  import HandFan from "./HandFan.svelte";

  interface Props {
    hands: Record<Seat, Hand>;
    userSeat: Seat;
    children?: Snippet;
    /** During play: seat whose hand is face-up as dummy */
    dummySeat?: Seat;
    /** During play: legal cards for the active seat */
    legalPlays?: readonly CardType[];
    /** During play: callback when user clicks a card */
    onPlayCard?: (card: CardType, seat: Seat) => void;
    /** During play: seat currently playing */
    currentPlayer?: Seat;
    /** During play: seats controlled by user (for showing clickable cards) */
    userControlledSeats?: readonly Seat[];
    /** During play: remaining cards per seat (after cards played in tricks) */
    remainingCards?: Partial<Record<Seat, readonly CardType[]>>;
  }

  let {
    hands,
    userSeat,
    children,
    dummySeat,
    legalPlays = [],
    onPlayCard,
    currentPlayer,
    userControlledSeats = [],
    remainingCards,
  }: Props = $props();

  function isFaceUp(seat: Seat): boolean {
    if (seat === userSeat) return true;
    if (seat === dummySeat) return true;
    return false;
  }

  function getCards(seat: Seat): readonly CardType[] {
    if (remainingCards && remainingCards[seat]) {
      return remainingCards[seat];
    }
    return hands[seat].cards;
  }

  function getSeatLegalPlays(seat: Seat): readonly CardType[] {
    if (currentPlayer === seat && userControlledSeats.includes(seat)) {
      return legalPlays;
    }
    return [];
  }

  function getSeatOnPlayCard(seat: Seat): ((card: CardType) => void) | undefined {
    if (currentPlayer === seat && userControlledSeats.includes(seat) && onPlayCard) {
      return (card: CardType) => onPlayCard(card, seat);
    }
    return undefined;
  }

  function seatLabelClass(seat: Seat): string {
    const base = "text-sm font-bold bg-bg-elevated/80 px-2.5 py-0.5 rounded-full";
    if (currentPlayer === seat) {
      return `${base} text-accent`;
    }
    return `${base} text-text-secondary`;
  }
</script>

<div
  class="bridge-table relative bg-table-surface border border-table-border rounded-[--radius-xl]"
  style="width: var(--table-width); height: var(--table-height);"
  role="region"
  aria-label="Bridge table"
  data-testid="bridge-table"
>
  <!-- North -->
  <div class="absolute seat-north">
    <HandFan cards={getCards(Seat.North)} faceUp={isFaceUp(Seat.North)} legalPlays={getSeatLegalPlays(Seat.North)} onPlayCard={getSeatOnPlayCard(Seat.North)} />
    <div class="text-center mt-2">
      <span class={seatLabelClass(Seat.North)} data-testid="seat-label-N" aria-label="North">N</span>
    </div>
  </div>

  <!-- South -->
  <div class="absolute z-10 seat-south">
    <div class="text-center mb-2">
      <span class={seatLabelClass(Seat.South)} data-testid="seat-label-S" aria-label="South">S</span>
    </div>
    <HandFan cards={getCards(Seat.South)} faceUp={isFaceUp(Seat.South)} legalPlays={getSeatLegalPlays(Seat.South)} onPlayCard={getSeatOnPlayCard(Seat.South)} />
  </div>

  <!-- East cards -->
  <div class="absolute seat-east">
    <HandFan cards={getCards(Seat.East)} faceUp={isFaceUp(Seat.East)} vertical legalPlays={getSeatLegalPlays(Seat.East)} onPlayCard={getSeatOnPlayCard(Seat.East)} />
  </div>
  <!-- East label — inset from edge to clear the vertical card fan (~12% card width + gap) -->
  <div class="absolute seat-label-east">
    <span class={seatLabelClass(Seat.East)} data-testid="seat-label-E" aria-label="East">E</span>
  </div>

  <!-- West cards -->
  <div class="absolute seat-west">
    <HandFan cards={getCards(Seat.West)} faceUp={isFaceUp(Seat.West)} vertical legalPlays={getSeatLegalPlays(Seat.West)} onPlayCard={getSeatOnPlayCard(Seat.West)} />
  </div>
  <!-- West label — inset from edge to clear the vertical card fan (~12% card width + gap) -->
  <div class="absolute seat-label-west">
    <span class={seatLabelClass(Seat.West)} data-testid="seat-label-W" aria-label="West">W</span>
  </div>

  <!-- Center area (auction or tricks) — positioned in upper-center to leave room for growing auction rows -->
  <div class="absolute seat-center" data-testid="table-center">
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>

<style>
  .bridge-table {
    --seat-edge: 2%;
    --seat-center: 50%;
    --seat-south-bottom: 8%;
    --seat-label-inset: 14%;
    --seat-center-top: 38%;
  }
  .seat-north {
    top: var(--seat-edge);
    left: var(--seat-center);
    transform: translateX(-50%);
  }
  .seat-south {
    bottom: var(--seat-south-bottom);
    left: var(--seat-center);
    transform: translateX(-50%);
  }
  .seat-east {
    top: var(--seat-center);
    right: var(--seat-edge);
    transform: translateY(-50%);
  }
  .seat-label-east {
    top: var(--seat-center);
    right: var(--seat-label-inset);
    transform: translateY(-50%);
  }
  .seat-west {
    top: var(--seat-center);
    left: var(--seat-edge);
    transform: translateY(-50%);
  }
  .seat-label-west {
    top: var(--seat-center);
    left: var(--seat-label-inset);
    transform: translateY(-50%);
  }
  .seat-center {
    top: var(--seat-center-top);
    left: var(--seat-center);
    transform: translate(-50%, -50%);
  }
</style>
