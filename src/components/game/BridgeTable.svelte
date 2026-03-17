<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Hand, Card as CardType } from "../../engine/types";
  import { Seat, Vulnerability } from "../../engine/types";
  import { viewSeat } from "../../core/display/seat-mapping";
  import { calculateHcp } from "../../engine/hand-evaluator";
  import { isVulnerable } from "../../engine/scoring";
  import HandFan from "./HandFan.svelte";

  interface Props {
    hands: Record<Seat, Hand>;
    /** Set of seats whose cards should be shown face-up. */
    faceUpSeats: ReadonlySet<Seat>;
    children?: Snippet;
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
    /** Deal vulnerability for visual indicators on seat labels */
    vulnerability?: Vulnerability;
    /** Dealer seat — shows "D" badge */
    dealer?: Seat;
  }

  let {
    hands,
    faceUpSeats,
    children,
    legalPlays = [],
    onPlayCard,
    currentPlayer,
    userControlledSeats = [],
    remainingCards,
    rotated = false,
    vulnerability,
    dealer: _dealer,
  }: Props = $props();

  const southHcp = $derived(calculateHcp(hands[Seat.South]));

  // Map physical screen positions to logical seats
  const northSeat = $derived(viewSeat(Seat.North, rotated));
  const southSeat = $derived(viewSeat(Seat.South, rotated));
  const eastSeat = $derived(viewSeat(Seat.East, rotated));
  const westSeat = $derived(viewSeat(Seat.West, rotated));

  function isFaceUp(seat: Seat): boolean {
    return faceUpSeats.has(seat);
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
    const vul = vulnerability ? isVulnerable(seat, vulnerability) : false;
    const bg = vul ? "bg-red-900/80 ring-1 ring-red-500/40" : "bg-bg-elevated/80";
    const base = `text-sm font-bold ${bg} px-2.5 py-0.5 rounded-full`;
    if (currentPlayer === seat) {
      return `${base} text-accent-primary`;
    }
    return `${base} ${vul ? "text-red-300" : "text-text-secondary"}`;
  }
</script>

<div
  class="bridge-table bg-table-surface border border-table-border rounded-[--radius-xl]"
  style="width: var(--table-width); height: var(--table-height);"
  role="region"
  aria-label="Bridge table"
  data-testid="bridge-table"
>
  <!-- Physical top position (North normally, South when rotated) -->
  <div class="area-north">
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

  <!-- Physical left position (West normally, East when rotated) + label -->
  <div class="area-west">
    <HandFan
      cards={getCards(westSeat)}
      faceUp={isFaceUp(westSeat)}
      vertical
      legalPlays={getSeatLegalPlays(westSeat)}
      onPlayCard={getSeatOnPlayCard(westSeat)}
    />
    <span
      class={seatLabelClass(westSeat)}
      data-testid="seat-label-{westSeat}"
      aria-label={westSeat === Seat.West ? "West" : "East"}
      >{westSeat === Seat.West ? "W" : "E"}</span
    >
  </div>

  <!-- Center area (auction or tricks) — dedicated grid cell, cannot overlap hands -->
  <div class="area-center" data-testid="table-center">
    {#if children}
      {@render children()}
    {/if}
  </div>

  <!-- Physical right position (East normally, West when rotated) + label -->
  <div class="area-east">
    <span
      class={seatLabelClass(eastSeat)}
      data-testid="seat-label-{eastSeat}"
      aria-label={eastSeat === Seat.East ? "East" : "West"}
      >{eastSeat === Seat.East ? "E" : "W"}</span
    >
    <HandFan
      cards={getCards(eastSeat)}
      faceUp={isFaceUp(eastSeat)}
      vertical
      legalPlays={getSeatLegalPlays(eastSeat)}
      onPlayCard={getSeatOnPlayCard(eastSeat)}
    />
  </div>

  <!-- Physical bottom position (South normally, North when rotated) -->
  <div class="area-south">
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
</div>

<style>
  .bridge-table {
    display: grid;
    grid-template-areas:
      "west   north  east"
      "west   center east"
      "west   south  east";
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-rows: auto minmax(0, 1fr) auto;
    padding: 6px 14px;
  }
  .area-north {
    grid-area: north;
    justify-self: center;
  }
  .area-south {
    grid-area: south;
    justify-self: center;
  }
  .area-west {
    grid-area: west;
    align-self: center;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .area-east {
    grid-area: east;
    align-self: center;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .area-center {
    grid-area: center;
    place-self: center;
  }
</style>
