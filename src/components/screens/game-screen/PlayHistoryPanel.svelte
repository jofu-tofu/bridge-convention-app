<script lang="ts">
  import type { Card as CardType } from "../../../service";
  import type { AuctionEntry } from "../../../service";
  import type { AuctionEntryView } from "../../../service";
  import { Suit } from "../../../service";
  import { SUIT_ORDER } from "../../../service";
  import { SUIT_SYMBOLS, displayRank } from "../../../service";
  import { SUIT_COLOR_CLASS } from "../../shared/tokens";
  import { sortCards } from "../../shared/sort-cards";
  import type { PlayHistoryBaseProps, PlayHistoryReplayProps } from "./shared-props";
  import SectionHeader from "../../shared/SectionHeader.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";

  interface Props extends PlayHistoryBaseProps, PlayHistoryReplayProps {}

  let {
    tricks,
    declarerSeat,
    auctionEntries,
    dealer,
    bidHistory,
    highlightTrickIndex = null,
    onClickTrick,
    visibleTrickCount,
    partialTrickPlays,
  }: Props = $props();

  const effectiveTricks = $derived(
    visibleTrickCount !== undefined ? tricks.slice(0, visibleTrickCount) : tricks,
  );

  let scrollContainer: HTMLDivElement | undefined = $state();

  // Auto-scroll to bottom when new tricks are added
  $effect(() => {
    const _len = tricks.length;
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  });

  /** Collect all played cards from completed tricks, sorted by suit then rank. */
  const playedBySuit = $derived.by(() => {
    const allPlayed: CardType[] = [];
    for (const trick of effectiveTricks) {
      for (const play of trick.plays) {
        allPlayed.push(play.card);
      }
    }
    const sorted = sortCards(allPlayed);
    const groups: { suit: Suit; cards: CardType[] }[] = [];
    for (const suit of SUIT_ORDER) {
      const cards = sorted.filter((c) => c.suit === suit);
      if (cards.length > 0) groups.push({ suit, cards });
    }
    return groups;
  });

  const effectiveEntries = $derived<readonly (AuctionEntryView | AuctionEntry)[]>(
    auctionEntries ?? [],
  );

  /** Resolve dealer: explicit prop or inferred from first entry */
  const resolvedDealer = $derived(
    dealer ?? (auctionEntries && auctionEntries.length > 0 ? auctionEntries[0]!.seat : undefined),
  );
</script>

<section class="flex flex-col h-full min-h-0" aria-label="Play history">
  <SectionHeader class="mb-1 shrink-0 px-1">Trick History</SectionHeader>

  {#if tricks.length === 0}
    <p class="text-[--text-body] text-text-muted italic px-1">No tricks played yet.</p>
  {:else}
    <div
      bind:this={scrollContainer}
      class="flex-1 overflow-y-auto space-y-1 min-h-0"
    >
      {#each effectiveTricks as trick, i (i)}
        {@const isLastVisible = visibleTrickCount !== undefined && i === visibleTrickCount - 1}
        {@const plays = isLastVisible && partialTrickPlays !== undefined ? trick.plays.slice(0, partialTrickPlays) : trick.plays}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="bg-bg-card rounded-[--radius-md] px-1.5 py-0.5 border {highlightTrickIndex === i ? 'border-accent-primary ring-1 ring-accent-primary/40' : 'border-border-subtle'} {onClickTrick ? 'cursor-pointer hover:bg-bg-elevated' : ''}"
          role={onClickTrick ? "button" : undefined}
          tabindex={onClickTrick ? 0 : undefined}
          onclick={() => onClickTrick?.(i)}
          onkeydown={(e: KeyboardEvent) => { if (onClickTrick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClickTrick(i); } }}
        >
          <div class="flex items-center gap-1">
            <span class="text-text-muted font-mono text-[--text-detail] w-3 shrink-0">{i + 1}</span>
            {#each plays as play (play.seat)}
              <span class="inline-flex items-center gap-0.5 text-[--text-detail] {play.seat === trick.winner ? 'font-bold' : 'opacity-70'}">
                <span class="text-text-muted">{play.seat}</span>
                <span class={SUIT_COLOR_CLASS[play.card.suit]}>
                  {displayRank(play.card.rank)}{SUIT_SYMBOLS[play.card.suit]}
                </span>
              </span>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Bottom summary: cards played + auction (always visible) -->
  <div class="shrink-0 border-t border-border-subtle mt-2 pt-2 space-y-2">
    <!-- Played cards as stacked mini-cards grouped by suit -->
    {#if playedBySuit.length > 0}
      <div>
        <SectionHeader level="h3" class="px-1 mb-1">Cards Played</SectionHeader>
        <div class="space-y-0.5 px-1">
          {#each playedBySuit as group (group.suit)}
            <div class="flex items-center gap-1">
              <span class="{SUIT_COLOR_CLASS[group.suit]} text-[--text-detail] shrink-0 w-3">{SUIT_SYMBOLS[group.suit]}</span>
              <div class="flex played-stack">
                {#each group.cards as card (card.rank)}
                  <div
                    class="mini-card bg-bg-elevated rounded-[--radius-sm] shadow-sm border border-border-subtle flex items-center justify-center {SUIT_COLOR_CLASS[card.suit]}"
                    aria-label="{displayRank(card.rank)} of {card.suit}"
                  >
                    <span class="font-bold leading-none">{displayRank(card.rank)}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Compact auction table (always shown) -->
    {#if resolvedDealer && effectiveEntries.length > 0}
      <div>
        <SectionHeader level="h3" class="px-1 mb-1">Auction</SectionHeader>
        <AuctionTable entries={effectiveEntries} dealer={resolvedDealer} minimal />
      </div>
    {/if}
  </div>
</section>

<style>
  .mini-card {
    /* Scale mini-cards with the panel font so they stay proportional */
    width: 1.4em;
    height: 1.8em;
    font-size: var(--text-label);
    flex-shrink: 0;
  }
  .played-stack > .mini-card + .mini-card {
    margin-left: -0.55em;
  }
</style>
