<script lang="ts">
  import type { Card as CardType, Seat } from "../../../service";
  import type { AuctionEntry } from "../../../service";
  import type { AuctionEntryView } from "../../../service";
  import { Suit } from "../../../service";
  import { SUIT_ORDER, SEAT_INDEX } from "../../../service";
  import { SUIT_SYMBOLS, displayRank, formatCall } from "../../../service";
  import { SUIT_COLOR_CLASS, BID_SUIT_COLOR_CLASS } from "../../shared/tokens";
  import { sortCards } from "../../shared/sort-cards";
  import type { PlayHistoryBaseProps, PlayHistoryReplayProps } from "./shared-props";

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

  const SEAT_LABELS: Seat[] = ["N" as Seat, "E" as Seat, "S" as Seat, "W" as Seat];

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

  /** Build compact auction rows (same logic as AuctionTable). */
  interface AuctionCell {
    text: string;
    colorClass: string;
    alertLabel?: string;
  }

  const auctionRows = $derived.by(() => {
    // Determine dealer: explicit prop or inferred from first auctionEntry
    const d = dealer ?? (auctionEntries && auctionEntries.length > 0 ? auctionEntries[0]!.seat : undefined);
    if (!d || effectiveEntries.length === 0) return [];
    const dealerIdx = SEAT_INDEX[d];
    const cells: AuctionCell[] = [];
    for (let i = 0; i < dealerIdx; i++) {
      cells.push({ text: "\u2014", colorClass: "text-text-muted" });
    }
    for (let i = 0; i < effectiveEntries.length; i++) {
      const entry = effectiveEntries[i]!;
      let colorClass = "";
      if (entry.call.type === "bid") {
        colorClass = BID_SUIT_COLOR_CLASS[entry.call.strain] ?? "";
      }
      // Viewport entries carry alertLabel directly; raw mode uses bidHistory
      const alertLabel = "alertLabel" in entry ? entry.alertLabel : bidHistory?.[i]?.alertLabel;
      cells.push({
        text: "callDisplay" in entry ? entry.callDisplay : formatCall(entry.call),
        colorClass: colorClass || "text-text-primary",
        alertLabel,
      });
    }
    const rows: AuctionCell[][] = [];
    for (let i = 0; i < cells.length; i += 4) {
      rows.push(cells.slice(i, i + 4));
    }
    return rows;
  });
</script>

<section class="flex flex-col h-full min-h-0" aria-label="Play history">
  <h2 class="text-[--text-label] font-medium text-text-muted mb-1 uppercase tracking-wider shrink-0 px-1">
    Trick History
  </h2>

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
        <h3 class="text-[--text-label] font-medium text-text-muted uppercase tracking-wider px-1 mb-1">Cards Played</h3>
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
    {#if auctionRows.length > 0}
      <div>
        <h3 class="text-[--text-label] font-medium text-text-muted uppercase tracking-wider px-1 mb-1">Auction</h3>
        <table class="w-full text-center text-[--text-label] font-mono" aria-label="Auction summary">
          <thead>
            <tr>
              {#each SEAT_LABELS as label (label)}
                <th class="px-1 py-0 text-text-muted font-medium">{label}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each auctionRows as row, rowIdx ("arow-" + rowIdx)}
              <tr class="border-t border-border-subtle/50">
                {#each row as cell, cellIdx (rowIdx * 4 + cellIdx)}
                  <td class="px-1 py-0 {cell.colorClass}" title={cell.alertLabel ?? ""}>
                    {cell.text}
                  </td>
                {/each}
                {#if row.length < 4}
                  {#each Array(4 - row.length) as _, padIdx (padIdx)}
                    <td class="px-1 py-0"></td>
                  {/each}
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
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
