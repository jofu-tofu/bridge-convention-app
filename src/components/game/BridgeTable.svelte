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
  class="relative bg-table-surface border border-table-border rounded-[--radius-xl]"
  style="width: var(--table-width); height: var(--table-height);"
  data-testid="bridge-table"
>
  <!-- North -->
  <div class="absolute" style="top: 2%; left: 50%; transform: translateX(-50%);">
    <HandFan cards={hands[Seat.North].cards} faceUp={userSeat === Seat.North} />
    <div class="text-center mt-2">
      <span class="text-sm font-bold text-text-secondary bg-bg-elevated/80 px-2.5 py-0.5 rounded-full" data-testid="seat-label-N">N</span>
    </div>
  </div>

  <!-- South -->
  <div class="absolute z-10" style="bottom: 8%; left: 50%; transform: translateX(-50%);">
    <div class="text-center mb-2">
      <span class="text-sm font-bold text-text-secondary bg-bg-elevated/80 px-2.5 py-0.5 rounded-full" data-testid="seat-label-S">S</span>
    </div>
    <HandFan cards={hands[Seat.South].cards} faceUp={userSeat === Seat.South} />
  </div>

  <!-- East cards -->
  <div class="absolute" style="top: 50%; right: 2%; transform: translateY(-50%);">
    <HandFan cards={hands[Seat.East].cards} faceUp={userSeat === Seat.East} vertical />
  </div>
  <!-- East label — inset from edge to clear the vertical card fan (~12% card width + gap) -->
  <div class="absolute" style="top: 50%; right: 14%; transform: translateY(-50%);">
    <span class="text-sm font-bold text-text-secondary bg-bg-elevated/80 px-2.5 py-0.5 rounded-full" data-testid="seat-label-E">E</span>
  </div>

  <!-- West cards -->
  <div class="absolute" style="top: 50%; left: 2%; transform: translateY(-50%);">
    <HandFan cards={hands[Seat.West].cards} faceUp={userSeat === Seat.West} vertical />
  </div>
  <!-- West label — inset from edge to clear the vertical card fan (~12% card width + gap) -->
  <div class="absolute" style="top: 50%; left: 14%; transform: translateY(-50%);">
    <span class="text-sm font-bold text-text-secondary bg-bg-elevated/80 px-2.5 py-0.5 rounded-full" data-testid="seat-label-W">W</span>
  </div>

  <!-- Center area (auction) — positioned in upper-center to leave room for growing auction rows -->
  <div class="absolute" style="top: 38%; left: 50%; transform: translate(-50%, -50%);" data-testid="table-center">
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>
