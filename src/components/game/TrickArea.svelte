<script lang="ts">
  import { Seat } from "../../engine/types";
  import type { PlayedCard, Suit } from "../../engine/types";
  import { viewSeat } from "../../lib/seat-mapping";
  import Card from "../shared/Card.svelte";

  interface Props {
    currentTrick: readonly PlayedCard[];
    currentPlayer: Seat | null;
    trumpSuit: Suit | undefined;
    /** When true, rotate card positions 180°: North's card at bottom, etc. */
    rotated?: boolean;
  }

  let {
    currentTrick,
    currentPlayer,
    trumpSuit,
    rotated = false,
  }: Props = $props();

  const seatPositions: Record<Seat, string> = {
    [Seat.North]: "trick-north",
    [Seat.East]: "trick-east",
    [Seat.South]: "trick-south",
    [Seat.West]: "trick-west",
  };

  function getPlayedCard(seat: Seat): PlayedCard | undefined {
    return currentTrick.find((p) => p.seat === seat);
  }
</script>

<div class="trick-area relative" aria-label="Current trick" data-testid="trick-area">
  <!-- Card positions for each seat -->
  {#each [Seat.North, Seat.East, Seat.South, Seat.West] as seat (seat)}
    {@const played = getPlayedCard(seat)}
    <div
      class="absolute {seatPositions[viewSeat(seat, rotated)]}"
      data-testid="trick-position-{seat}"
    >
      {#if played}
        <Card card={played.card} faceUp />
      {:else if currentPlayer === seat}
        <div
          class="trick-placeholder trick-placeholder-active"
          data-testid="trick-placeholder-active"
        ></div>
      {:else}
        <div class="trick-placeholder"></div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .trick-area {
    width: calc(var(--card-width) * 3 + 16px);
    height: calc(var(--card-height) * 2.5);
  }

  .trick-north {
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
  }
  .trick-south {
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
  }
  .trick-east {
    top: 50%;
    right: 0;
    transform: translateY(-50%);
  }
  .trick-west {
    top: 50%;
    left: 0;
    transform: translateY(-50%);
  }

  .trick-placeholder {
    width: var(--card-width);
    height: var(--card-height);
    border: 1px dashed var(--color-border-subtle);
    border-radius: var(--radius-md);
    opacity: 0.3;
  }

  .trick-placeholder-active {
    border-color: var(--color-accent);
    opacity: 0.6;
  }
</style>
