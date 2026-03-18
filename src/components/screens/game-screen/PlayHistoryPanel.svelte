<script lang="ts">
  import type { Trick, Seat, Deal, Card as CardType } from "../../../engine/types";
  import type { Auction } from "../../../engine/types";
  import type { BidHistoryEntry } from "../../../core/contracts";
  import { Suit } from "../../../engine/types";
  import { SUIT_ORDER } from "../../../engine/constants";
  import { SUIT_SYMBOLS, displayRank, formatCall } from "../../../core/display/format";
  import { SUIT_CARD_COLOR_CLASS, BID_SUIT_COLOR_CLASS } from "../../../core/display/tokens";
  import { sortCards } from "../../../core/display/sort-cards";
  import { SEAT_INDEX } from "../../../engine/constants";

  interface Props {
    tricks: readonly Trick[];
    declarerSeat: Seat | null;
    auction?: Auction;
    dealer?: Seat;
    bidHistory?: readonly BidHistoryEntry[];
    deal?: Deal;
  }

  let { tricks, declarerSeat, auction, dealer, bidHistory, deal }: Props = $props();

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

  /** Group cards by suit for a compact text display: ♠AKQ4 ♥KJ3 ♦T94 ♣J82 */
  function formatHandBySuit(cards: readonly CardType[]): { suit: Suit; ranks: string }[] {
    const sorted = sortCards(cards);
    const groups: { suit: Suit; ranks: string }[] = [];
    for (const suit of SUIT_ORDER) {
      const ranks = sorted
        .filter((c) => c.suit === suit)
        .map((c) => displayRank(c.rank))
        .join("");
      if (ranks) groups.push({ suit, ranks });
    }
    return groups;
  }

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

  <!-- Compact bid summary + original hands -->
  {#if auction && auction.entries.length > 0 && deal}
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

      <!-- Original hands sorted by suit -->
      <div>
        <h3 class="text-[10px] font-medium text-text-muted uppercase tracking-wider px-1 mb-1">Hands</h3>
        <div class="space-y-0.5 px-1">
          {#each SEAT_LABELS as seat (seat)}
            <div class="flex items-baseline gap-1 text-[11px] leading-tight">
              <span class="text-text-muted font-mono w-3 shrink-0">{seat}</span>
              <span class="flex flex-wrap gap-x-1.5">
                {#each formatHandBySuit(deal.hands[seat].cards) as group (group.suit)}
                  <span class="whitespace-nowrap">
                    <span class={SUIT_CARD_COLOR_CLASS[group.suit]}>{SUIT_SYMBOLS[group.suit]}</span><span class="text-text-primary">{group.ranks}</span>
                  </span>
                {/each}
              </span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</section>
