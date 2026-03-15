<script lang="ts">
  import { Seat, Suit } from "../../../engine/types";
  import type { PublicBeliefState } from "../../../inference/types";
  import { fmtCall } from "./debug-helpers";

  interface Props {
    publicBeliefState: PublicBeliefState;
    allSeats: readonly Seat[];
  }

  let { publicBeliefState, allSeats }: Props = $props();
</script>

<details>
  <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">
    Public Beliefs
    {#if publicBeliefState.annotations.length > 0}
      <span class="text-text-muted font-normal">({publicBeliefState.annotations.length} annotations)</span>
    {/if}
  </summary>
  <div class="pl-2 py-1">
    <!-- Per-seat beliefs -->
    {#each allSeats as seat (seat)}
      {@const inf = publicBeliefState.beliefs[seat]}
      <div class="mb-1.5">
        <span class="text-text-primary font-semibold">{seat}</span>
        <span class="text-text-muted ml-1">HCP: {inf.hcpRange.min}-{inf.hcpRange.max}</span>
        {#if inf.isBalanced !== undefined}
          <span class="text-text-muted ml-1">Bal: {inf.isBalanced ? "Y" : "N"}</span>
        {/if}
        <div class="pl-2">
          {#each [{ suit: Suit.Spades, sym: "\u2660" }, { suit: Suit.Hearts, sym: "\u2665" }, { suit: Suit.Diamonds, sym: "\u2666" }, { suit: Suit.Clubs, sym: "\u2663" }] as { suit, sym } (suit)}
            {@const sl = inf.suitLengths[suit]}
            <span class="mr-2 {suit === Suit.Hearts || suit === Suit.Diamonds ? 'text-red-400' : 'text-text-primary'}">{sym}{sl.min}-{sl.max}</span>
          {/each}
        </div>
      </div>
    {/each}
    <!-- Annotations -->
    {#if publicBeliefState.annotations.length > 0}
      <div class="border-t border-border-subtle/30 pt-1 mt-1">
        <span class="text-text-muted font-semibold">Annotations:</span>
        {#each publicBeliefState.annotations as ann, i (i)}
          <div class="pl-2">
            <span class="text-text-primary">{ann.seat}:</span>
            <span class="text-cyan-300 ml-1">{fmtCall(ann.call)}</span>
            <span class="text-text-muted ml-1">{ann.meaning}</span>
            {#if ann.conventionId}
              <span class="text-purple-300 ml-1">[{ann.conventionId}]</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</details>
