<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Hand } from "../../engine/types";
  import { Seat } from "../../engine/types";
  import HandFan from "./HandFan.svelte";

  interface Props {
    hands: Record<Seat, Hand>;
    userSeat: Seat;
    children?: Snippet;
  }

  let { hands, userSeat, children }: Props = $props();

</script>

<div
  class="bridge-table relative bg-table-surface border border-table-border rounded-[--radius-xl]"
  style="width: var(--table-width); height: var(--table-height);"
  data-testid="bridge-table"
>
  <!-- North -->
  <div class="absolute seat-north">
    <HandFan cards={hands[Seat.North].cards} faceUp={userSeat === Seat.North} />
    <div class="text-center mt-2">
      <span class="text-sm font-bold text-text-secondary bg-bg-elevated/80 px-2.5 py-0.5 rounded-full" data-testid="seat-label-N">N</span>
    </div>
  </div>

  <!-- South -->
  <div class="absolute z-10 seat-south">
    <div class="text-center mb-2">
      <span class="text-sm font-bold text-text-secondary bg-bg-elevated/80 px-2.5 py-0.5 rounded-full" data-testid="seat-label-S">S</span>
    </div>
    <HandFan cards={hands[Seat.South].cards} faceUp={userSeat === Seat.South} />
  </div>

  <!-- East cards -->
  <div class="absolute seat-east">
    <HandFan cards={hands[Seat.East].cards} faceUp={userSeat === Seat.East} vertical />
  </div>
  <!-- East label — inset from edge to clear the vertical card fan (~12% card width + gap) -->
  <div class="absolute seat-label-east">
    <span class="text-sm font-bold text-text-secondary bg-bg-elevated/80 px-2.5 py-0.5 rounded-full" data-testid="seat-label-E">E</span>
  </div>

  <!-- West cards -->
  <div class="absolute seat-west">
    <HandFan cards={hands[Seat.West].cards} faceUp={userSeat === Seat.West} vertical />
  </div>
  <!-- West label — inset from edge to clear the vertical card fan (~12% card width + gap) -->
  <div class="absolute seat-label-west">
    <span class="text-sm font-bold text-text-secondary bg-bg-elevated/80 px-2.5 py-0.5 rounded-full" data-testid="seat-label-W">W</span>
  </div>

  <!-- Center area (auction) — positioned in upper-center to leave room for growing auction rows -->
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
