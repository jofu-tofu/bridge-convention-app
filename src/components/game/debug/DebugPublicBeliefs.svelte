<script lang="ts">
  import { Seat, Suit } from "../../../service";
  import type { ServicePublicBeliefState } from "../../../service";
  import { fmtCall } from "./debug-helpers";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    publicBeliefState: ServicePublicBeliefState;
    allSeats: readonly Seat[];
  }

  let { publicBeliefState, allSeats }: Props = $props();
</script>

<DebugSection
  title="Public Beliefs"
  count={publicBeliefState.annotations.length || null}
  preview={publicBeliefState.annotations.length > 0 ? `${publicBeliefState.annotations.length} annotations` : null}
>
  <!-- Per-seat beliefs — compact single-line per seat -->
  {#each allSeats as seat (seat)}
    {@const beliefs = publicBeliefState.beliefs[seat]}
    {#if beliefs?.ranges}
    <div class="text-[10px] leading-tight mb-0.5">
      <span class="font-semibold text-text-primary inline-block w-5">{seat}</span>
      <span class="text-text-muted">HCP:{beliefs.ranges.hcp.min}-{beliefs.ranges.hcp.max}</span>
      {#if beliefs.ranges.isBalanced !== undefined}
        <span class="text-text-muted ml-1">Bal:{beliefs.ranges.isBalanced ? "Y" : "N"}</span>
      {/if}
      {#each [{ suit: Suit.Spades, sym: "\u2660" }, { suit: Suit.Hearts, sym: "\u2665" }, { suit: Suit.Diamonds, sym: "\u2666" }, { suit: Suit.Clubs, sym: "\u2663" }] as { suit, sym } (suit)}
        {@const sl = beliefs.ranges.suitLengths[suit]}
        <span class="ml-1 {suit === Suit.Hearts || suit === Suit.Diamonds ? 'text-red-400' : 'text-text-primary'}">{sym}{sl.min}-{sl.max}</span>
      {/each}
      {#if beliefs.qualitative.length > 0}
        {#each beliefs.qualitative as q (q.factId)}
          <span class="text-amber-300 ml-1">{q.label}</span>
        {/each}
      {/if}
    </div>
    {/if}
  {/each}

  <!-- Annotations — collapsed if present -->
  {#if publicBeliefState.annotations.length > 0}
    <DebugSection title="Annotations" count={publicBeliefState.annotations.length} nested>
      {#each publicBeliefState.annotations as ann, i (i)}
        <div class="text-[10px] leading-tight">
          <span class="text-text-primary">{ann.seat}:</span>
          <span class="text-cyan-300 ml-0.5">{fmtCall(ann.call)}</span>
          <span class="text-text-muted ml-0.5">{ann.meaning}</span>
          {#if ann.conventionId}
            <span class="text-purple-300 ml-0.5">[{ann.conventionId}]</span>
          {/if}
        </div>
      {/each}
    </DebugSection>
  {/if}
</DebugSection>
