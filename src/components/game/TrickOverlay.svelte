<script lang="ts">
  import type { Trick, PlayRecommendation } from "../../service";
  import { Seat } from "../../service";
  import { viewSeat } from "../shared/seat-mapping";
  import Card from "../shared/Card.svelte";

  interface Props {
    trick: Trick;
    recommendation: PlayRecommendation | undefined;
    rotated?: boolean;
    /** When set, only render this many plays instead of all 4. */
    visiblePlays?: number;
  }

  let {
    trick,
    recommendation,
    rotated = false,
    visiblePlays,
  }: Props = $props();

  const effectivePlays = $derived(
    visiblePlays !== undefined ? trick.plays.slice(0, visiblePlays) : trick.plays,
  );

  const seatPositions: Record<Seat, string> = {
    [Seat.North]: "trick-north",
    [Seat.East]: "trick-east",
    [Seat.South]: "trick-south",
    [Seat.West]: "trick-west",
  };
</script>

<div
  class="trick-overlay relative"
  aria-label="Trick review overlay"
  data-testid="trick-overlay"
>
  {#each effectivePlays as play (play.seat)}
    {@const isSuboptimal = recommendation && !recommendation.isOptimal && recommendation.seat === play.seat}
    <div class="absolute {seatPositions[viewSeat(play.seat, rotated)]}">
      <Card card={play.card} faceUp />
      {#if isSuboptimal && recommendation}
        <div class="absolute -right-2 -top-2 opacity-50">
          <Card card={recommendation.recommendedCard} faceUp />
        </div>
      {/if}
    </div>
  {/each}
  {#if trick.winner}
    <div class="absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-accent-success/80 text-white text-[--text-annotation] font-bold">
      {trick.winner}
    </div>
  {/if}
</div>

<style>
  .trick-overlay {
    width: calc(var(--card-width) * 3.2 + 24px);
    height: calc(var(--card-height) * 2.8);
  }

  .trick-north {
    top: 0;
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
</style>
