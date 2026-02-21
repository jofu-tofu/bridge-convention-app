<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Hand } from "../../engine/types";
  import { Seat } from "../../engine/types";
  import HandFan from "./HandFan.svelte";

  interface Props {
    hands: Record<Seat, Hand>;
    userSeat: Seat;
    dealer: Seat;
    children?: Snippet;
  }

  let { hands, userSeat, dealer, children }: Props = $props();

  const SEAT_LABELS: Record<Seat, string> = {
    [Seat.North]: "N",
    [Seat.East]: "E",
    [Seat.South]: "S",
    [Seat.West]: "W",
  };

  const POSITIONS: Record<Seat, { top: string; left: string; transform: string }> = {
    [Seat.North]: { top: "2%", left: "50%", transform: "translateX(-50%)" },
    [Seat.South]: { top: "auto", left: "50%", transform: "translateX(-50%)" },
    [Seat.East]: { top: "50%", left: "auto", transform: "translateY(-50%)" },
    [Seat.West]: { top: "50%", left: "2%", transform: "translateY(-50%)" },
  };

  const LABEL_POSITIONS: Record<Seat, string> = {
    [Seat.North]: "top-0 left-1/2 -translate-x-1/2 -translate-y-full",
    [Seat.South]: "bottom-0 left-1/2 -translate-x-1/2 translate-y-full",
    [Seat.East]: "top-1/2 right-0 -translate-y-1/2 translate-x-full",
    [Seat.West]: "top-1/2 left-0 -translate-y-1/2 -translate-x-full",
  };
</script>

<div
  class="relative bg-table-surface border border-table-border rounded-[--radius-xl]"
  style="width: var(--table-width); height: var(--table-height);"
  data-testid="bridge-table"
>
  <!-- North -->
  <div class="absolute" style="top: 2%; left: 50%; transform: translateX(-50%);">
    <div class="text-center mb-1">
      <span class="text-xs font-bold text-text-muted" data-testid="seat-label-N">N</span>
    </div>
    <HandFan cards={hands[Seat.North].cards} faceUp={userSeat === Seat.North} />
  </div>

  <!-- South -->
  <div class="absolute" style="bottom: 2%; left: 50%; transform: translateX(-50%);">
    <HandFan cards={hands[Seat.South].cards} faceUp={userSeat === Seat.South} />
    <div class="text-center mt-1">
      <span class="text-xs font-bold text-text-muted" data-testid="seat-label-S">S</span>
    </div>
  </div>

  <!-- East -->
  <div class="absolute" style="top: 50%; right: 2%; transform: translateY(-50%);">
    <div class="text-center mb-1">
      <span class="text-xs font-bold text-text-muted" data-testid="seat-label-E">E</span>
    </div>
    <HandFan cards={hands[Seat.East].cards} faceUp={userSeat === Seat.East} vertical />
  </div>

  <!-- West -->
  <div class="absolute" style="top: 50%; left: 2%; transform: translateY(-50%);">
    <div class="text-center mb-1">
      <span class="text-xs font-bold text-text-muted" data-testid="seat-label-W">W</span>
    </div>
    <HandFan cards={hands[Seat.West].cards} faceUp={userSeat === Seat.West} vertical />
  </div>

  <!-- Center area -->
  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" data-testid="table-center">
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>
