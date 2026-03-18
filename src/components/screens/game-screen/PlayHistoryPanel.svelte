<script lang="ts">
  import type { Trick, Seat, Card as CardType } from "../../../engine/types";
  import type { Auction } from "../../../engine/types";
  import type { BidHistoryEntry } from "../../../core/contracts";
  import { Suit } from "../../../engine/types";
  import { SUIT_ORDER, SEAT_INDEX } from "../../../engine/constants";
  import { SUIT_SYMBOLS, displayRank, formatCall } from "../../../core/display/format";
  import { SUIT_CARD_COLOR_CLASS, BID_SUIT_COLOR_CLASS } from "../../../core/display/tokens";
  import { sortCards } from "../../../core/display/sort-cards";

  interface Props {
    tricks: readonly Trick[];
    declarerSeat: Seat | null;
    auction?: Auction;
    dealer?: Seat;
    bidHistory?: readonly BidHistoryEntry[];
  }

  let { tricks, declarerSeat, auction, dealer, bidHistory }: Props = $props();

  let scrollContainer: HTMLDivElement | undefined = $state();

  // Auto-scroll to bottom when new tricks are added
  $effect(() => {
    // Access tricks.length to register the dependency
    const _len = tricks.length;
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  });

  const SEAT_LABELS: Seat[] = ["N" as Seat, "E" as Seat, "S" as Seat, "W" as Seat];

  /** Collect all played cards from completed tricks, sorted by suit then rank. */
  const playedBySuit = $derived.by(() => {
    const allPlayed: CardType[] = [];
    for (const trick of tricks) {
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

  /** Build compact auction rows (same logic as AuctionTable). */
  interface AuctionCell {
    text: string;
    colorClass: string;
    alertLabel?: string;
  }

  const auctionRows = $derived.by(() => {
    if (!auction || !dealer) return [];
    const dealerIdx = SEAT_INDEX[dealer];
    const cells: AuctionCell[] = [];
    for (let i = 0; i < dealerIdx; i++) {
      cells.push({ text: "\u2014", colorClass: "text-text-muted" });
    }
    for (let i = 0; i < auction.entries.length; i++) {
      const entry = auction.entries[i]!;
      let colorClass = "";
      if (entry.call.type === "bid") {
        colorClass = BID_SUIT_COLOR_CLASS[entry.call.strain] ?? "";
      }
      cells.push({
        text: formatCall(entry.call),
        colorClass: colorClass || "text-text-primary",
        alertLabel: bidHistory?.[i]?.alertLabel,
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
              {#each trick.plays as play (play.seat)}
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

  <!-- Compact bid summary + cards played -->
  {#if auction && auction.entries.length > 0}
    <div class="shrink-0 border-t border-border-subtle mt-2 pt-2 space-y-2">
      <!-- Compact auction table -->
      <div>
        <h3 class="text-[10px] font-medium text-text-muted uppercase tracking-wider px-1 mb-1">Auction</h3>
        <table class="w-full text-center text-[11px] font-mono" aria-label="Auction summary">
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

      <!-- Played cards as stacked mini-cards grouped by suit -->
      {#if playedBySuit.length > 0}
        <div>
          <h3 class="text-[10px] font-medium text-text-muted uppercase tracking-wider px-1 mb-1">Cards Played</h3>
          <div class="space-y-1 px-1">
            {#each playedBySuit as group (group.suit)}
              <div class="flex items-center gap-1">
                <span class="{SUIT_CARD_COLOR_CLASS[group.suit]} text-xs shrink-0 w-3">{SUIT_SYMBOLS[group.suit]}</span>
                <div class="flex played-stack">
                  {#each group.cards as card (card.rank)}
                    <div
                      class="mini-card bg-card-face rounded-sm shadow-sm border border-black/10 flex items-center justify-center {SUIT_CARD_COLOR_CLASS[card.suit]}"
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
    </div>
  {/if}
</section>

<style>
  .mini-card {
    width: 20px;
    height: 26px;
    font-size: 10px;
    flex-shrink: 0;
  }
  .played-stack > .mini-card + .mini-card {
    margin-left: -8px;
  }
</style>
