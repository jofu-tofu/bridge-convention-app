<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Hand, Card as CardType } from "../../engine/types";
  import { Seat } from "../../engine/types";
  import { viewSeat } from "../../lib/seat-mapping";
  import { computeHcp } from "../../lib/hcp";
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
    /** When true, rotate table 180°: North at bottom, South at top, E↔W swapped */
    rotated?: boolean;
    /** When true, all hands are shown face-up (review mode) */
    showAll?: boolean;
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
    rotated = false,
    showAll = false,
  }: Props = $props();

  const southHcp = $derived(computeHcp(hands[Seat.South]));

  // Map physical screen positions to logical seats
  const northSeat = $derived(viewSeat(Seat.North, rotated));
  const southSeat = $derived(viewSeat(Seat.South, rotated));
  const eastSeat = $derived(viewSeat(Seat.East, rotated));
  const westSeat = $derived(viewSeat(Seat.West, rotated));

  function isFaceUp(seat: Seat): boolean {
    if (showAll) return true;
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

  function getSeatOnPlayCard(
    seat: Seat,
  ): ((card: CardType) => void) | undefined {
    if (
      currentPlayer === seat &&
      userControlledSeats.includes(seat) &&
      onPlayCard
    ) {
      return (card: CardType) => onPlayCard(card, seat);
    }
    return undefined;
  }

  function seatLabelClass(seat: Seat): string {
    const base =
      "text-sm font-bold bg-bg-elevated/80 px-2.5 py-0.5 rounded-full";
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
  <!-- Physical top position (North normally, South when rotated) -->
  <div class="absolute seat-north">
    <HandFan
      cards={getCards(northSeat)}
      faceUp={isFaceUp(northSeat)}
      legalPlays={getSeatLegalPlays(northSeat)}
      onPlayCard={getSeatOnPlayCard(northSeat)}
      mirrored
    />
    <div class="text-center mt-2">
      <span
        class={seatLabelClass(northSeat)}
        data-testid="seat-label-{northSeat}"
        aria-label={northSeat === Seat.North ? "North" : "South"}
        >{northSeat === Seat.North ? "N" : "S"}</span
      >
    </div>
  </div>

  <!-- Physical bottom position (South normally, North when rotated) — z-10 stays on bottom hand -->
  <div class="absolute z-10 seat-south">
    <div class="text-center mb-2 flex items-center justify-center gap-1.5">
      <span
        class={seatLabelClass(southSeat)}
        data-testid="seat-label-{southSeat}"
        aria-label={southSeat === Seat.South ? "South" : "North"}
        >{southSeat === Seat.South ? "S" : "N"}</span
      >
      <span
        class="text-xs text-text-secondary bg-bg-elevated/60 px-1.5 py-0.5 rounded-full"
        data-testid="south-hcp"
        aria-label="{southHcp} high card points"
        >{southHcp} HCP</span
      >
    </div>
    <HandFan
      cards={getCards(southSeat)}
      faceUp={isFaceUp(southSeat)}
      legalPlays={getSeatLegalPlays(southSeat)}
      onPlayCard={getSeatOnPlayCard(southSeat)}
    />
  </div>

  <!-- Physical right position (East normally, West when rotated) -->
  <div class="absolute seat-east">
    <HandFan
      cards={getCards(eastSeat)}
      faceUp={isFaceUp(eastSeat)}
      vertical
      legalPlays={getSeatLegalPlays(eastSeat)}
      onPlayCard={getSeatOnPlayCard(eastSeat)}
    />
  </div>
  <!-- East label — inset from edge to clear the vertical card fan (~12% card width + gap) -->
  <div class="absolute seat-label-east">
    <span
      class={seatLabelClass(eastSeat)}
      data-testid="seat-label-{eastSeat}"
      aria-label={eastSeat === Seat.East ? "East" : "West"}
      >{eastSeat === Seat.East ? "E" : "W"}</span
    >
  </div>

  <!-- Physical left position (West normally, East when rotated) -->
  <div class="absolute seat-west">
    <HandFan
      cards={getCards(westSeat)}
      faceUp={isFaceUp(westSeat)}
      vertical
      legalPlays={getSeatLegalPlays(westSeat)}
      onPlayCard={getSeatOnPlayCard(westSeat)}
    />
  </div>
  <!-- West label — inset from edge to clear the vertical card fan (~12% card width + gap) -->
  <div class="absolute seat-label-west">
    <span
      class={seatLabelClass(westSeat)}
      data-testid="seat-label-{westSeat}"
      aria-label={westSeat === Seat.West ? "West" : "East"}
      >{westSeat === Seat.West ? "W" : "E"}</span
    >
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
    --seat-edge: 4%;
    --seat-center: 50%;
    --seat-south-bottom: 4%;
    --seat-label-inset: 14%;
    --seat-center-top: 42%;
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
