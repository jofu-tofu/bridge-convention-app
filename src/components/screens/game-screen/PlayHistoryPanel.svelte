<script lang="ts">
  import type { Trick, Seat } from "../../../engine/types";
  import { SUIT_SYMBOLS, displayRank } from "../../../core/display/format";
  import { SUIT_CARD_COLOR_CLASS } from "../../../core/display/tokens";

  interface Props {
    tricks: readonly Trick[];
    declarerSeat: Seat | null;
  }

  let { tricks, declarerSeat }: Props = $props();

  let scrollContainer: HTMLDivElement | undefined = $state();

  // Auto-scroll to bottom when new tricks are added
  $effect(() => {
    // Access tricks.length to register the dependency
    const _len = tricks.length;
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  });
</script>

<section class="flex flex-col h-full min-h-0" aria-label="Play history">
  <h2 class="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider shrink-0 px-1">
    Trick History
  </h2>

  {#if tricks.length === 0}
    <p class="text-sm text-text-muted italic px-1">No tricks played yet.</p>
  {:else}
    <div
      bind:this={scrollContainer}
      class="flex-1 overflow-y-auto space-y-1 min-h-0"
    >
      {#each tricks as trick, i (i)}
        <div class="bg-bg-card rounded-[--radius-md] px-2 py-1.5 border border-border-subtle text-sm">
          <div class="flex items-center gap-2">
            <span class="text-text-muted font-mono text-xs w-4 shrink-0">{i + 1}</span>
            <div class="flex gap-1.5 flex-wrap flex-1">
              {#each trick.plays as play}
                <span class="inline-flex items-center gap-0.5 {play.seat === trick.winner ? 'font-bold' : 'opacity-70'}">
                  <span class="text-text-muted text-xs">{play.seat}</span>
                  <span class={SUIT_CARD_COLOR_CLASS[play.card.suit]}>
                    {displayRank(play.card.rank)}{SUIT_SYMBOLS[play.card.suit]}
                  </span>
                </span>
              {/each}
            </div>
            {#if trick.winner}
              <span class="text-xs text-text-muted shrink-0" title="Winner">
                {trick.winner === declarerSeat ? 'Decl' : 'Def'}
              </span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>
