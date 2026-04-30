<script lang="ts">
  import type { Trick, Contract, PlayRecommendation } from "../../service";
  import { Seat, SUIT_SYMBOLS, displayRank } from "../../service";
  import { SUIT_COLOR_CLASS } from "../shared/tokens";
  import { getAppStore } from "../../stores/context";

  const appStore = getAppStore();

  interface Props {
    tricks: readonly Trick[];
    recommendations: readonly PlayRecommendation[];
    contract: Contract;
    userSeat: Seat;
    declarerTricksWon: number;
    defenderTricksWon: number;
    selectedTrickIndex: number | null;
    onSelectTrick: (index: number | null) => void;
  }

  let {
    tricks,
    recommendations,
    contract,
    userSeat,
    declarerTricksWon,
    defenderTricksWon,
    selectedTrickIndex,
    onSelectTrick,
  }: Props = $props();

  const optimalCount = $derived(recommendations.filter((r) => r.isOptimal).length);
  const totalCount = $derived(recommendations.length);

  function getRecsForTrick(trickIdx: number): readonly PlayRecommendation[] {
    return recommendations.filter((r) => r.trickIndex === trickIdx);
  }

  function isTrickOptimal(trickIdx: number): boolean | null {
    const recs = getRecsForTrick(trickIdx);
    if (recs.length === 0) return null;
    return recs.every((r) => r.isOptimal);
  }

  const selectedTrick = $derived(
    selectedTrickIndex !== null && selectedTrickIndex < tricks.length
      ? tricks[selectedTrickIndex]
      : null,
  );

  const selectedRecs = $derived(
    selectedTrickIndex !== null ? getRecsForTrick(selectedTrickIndex) : [],
  );
</script>

<!-- Summary -->
<div class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle mb-3">
  <div class="flex items-center justify-between">
    <p class="text-[--text-label] font-medium text-text-muted">Play Review</p>
    <span class="text-[--text-detail] text-text-secondary">
      {declarerTricksWon} tricks won ({defenderTricksWon} lost)
    </span>
  </div>
  {#if totalCount > 0}
    <p class="text-[--text-detail] mt-1 {optimalCount === totalCount ? 'text-accent-success' : 'text-accent-warning'}">
      {optimalCount}/{totalCount} optimal plays
    </p>
  {/if}
</div>

<!-- Trick stepper -->
<div class="flex flex-wrap gap-1 mb-3" role="group" aria-label="Trick selector">
  {#each tricks as _, idx (idx)}
    {@const optimal = isTrickOptimal(idx)}
    <button
      type="button"
      class="min-w-[--size-touch-target] min-h-[--size-touch-target] px-2 py-1 rounded-[--radius-md] text-[--text-detail] font-medium transition-colors cursor-pointer
        {selectedTrickIndex === idx
          ? 'bg-accent-primary text-white'
          : optimal === true
            ? 'bg-accent-success/20 text-accent-success hover:bg-accent-success/30'
            : optimal === false
              ? 'bg-accent-warning/20 text-accent-warning hover:bg-accent-warning/30'
              : 'bg-bg-elevated text-text-secondary hover:bg-bg-card'}"
      aria-pressed={selectedTrickIndex === idx}
      onclick={() => onSelectTrick(selectedTrickIndex === idx ? null : idx)}
    >
      {idx + 1}
    </button>
  {/each}
</div>

<!-- Trick detail -->
{#if selectedTrick}
  <div class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle space-y-2">
    <p class="text-[--text-label] font-medium text-text-muted">
      Trick {(selectedTrickIndex ?? 0) + 1}
      {#if selectedTrick.winner}
        <span class="text-text-secondary"> &mdash; won by {selectedTrick.winner}</span>
      {/if}
    </p>
    {#each selectedTrick.plays as play, playIdx (playIdx)}
      {@const rec = selectedRecs.find((r) => r.playIndex === playIdx && r.seat === play.seat)}
      <div class="flex items-center gap-2 py-1 {play.seat === selectedTrick.winner ? 'font-bold' : ''}">
        <span
          class="w-6 text-[--text-detail] font-bold {play.seat === userSeat || play.seat === contract.declarer
            ? 'text-accent-primary'
            : 'text-text-muted'}"
        >
          {play.seat}
        </span>
        <span class="text-[--text-value] {SUIT_COLOR_CLASS[play.card.suit]}">
          {SUIT_SYMBOLS[play.card.suit]}{displayRank(play.card.rank, appStore.displaySettings.tenNotation)}
        </span>
        {#if rec}
          {#if rec.isOptimal}
            <span class="text-accent-success text-[--text-detail]" aria-label="Optimal play">&#10003;</span>
          {:else}
            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-warning/20 text-accent-warning text-[--text-annotation]">
              <span class="{SUIT_COLOR_CLASS[rec.recommendedCard.suit]}">
                {SUIT_SYMBOLS[rec.recommendedCard.suit]}{displayRank(rec.recommendedCard.rank, appStore.displaySettings.tenNotation)}
              </span>
              <span class="text-text-secondary">{rec.reason}</span>
            </span>
          {/if}
        {/if}
        {#if play.seat === selectedTrick.winner}
          <span class="text-accent-success text-[--text-annotation]" aria-label="Trick winner">&#9733;</span>
        {/if}
      </div>
    {/each}
  </div>
{:else}
  <div class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle">
    <p class="text-text-muted text-[--text-detail]">Select a trick above to see details.</p>
  </div>
{/if}
