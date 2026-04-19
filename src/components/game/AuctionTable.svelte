<script lang="ts">
  import type { AuctionEntry, AuctionEntryView } from "../../service";
  import type { BidHistoryEntry } from "../../service";
  import { Seat } from "../../service";
  import { SEAT_INDEX } from "../../service";
  import { formatCall } from "../../service";
  import { BID_SUIT_COLOR_CLASS } from "../shared/tokens";
  import BidBadge from "./BidBadge.svelte";
  import type { AnnotationType } from "./BidBadge";
  import { isOpen, requestOpen, requestClose } from "./bid-badge-state.svelte";

  interface Props {
    entries: readonly (AuctionEntry | AuctionEntryView)[];
    dealer: Seat;
    compact?: boolean;
    /** Minimal mode: tighter padding, no legend, no caption. Used by PlayHistoryPanel. */
    minimal?: boolean;
    /** Optional bid history with alert labels for annotation display. */
    bidHistory?: readonly BidHistoryEntry[];
    /** When false, hides gray educational annotations (keeps alerts & announcements). */
    showEducationalAnnotations?: boolean;
  }

  let {
    entries,
    dealer,
    compact = false,
    minimal = false,
    bidHistory,
    showEducationalAnnotations = true,
  }: Props = $props();

  const SEAT_LABELS = ["N", "E", "S", "W"];
  const LEGEND_ID = "auction-legend";

  interface CellData {
    text: string;
    isPlaceholder: boolean;
    colorClass: string;
    bidIndex?: number;
    alertLabel?: string;
    annotationType?: AnnotationType;
    publicConditions?: readonly string[];
  }

  const rows = $derived.by(() => {
    const dealerIdx = SEAT_INDEX[dealer];
    const cells: CellData[] = [];

    for (let i = 0; i < dealerIdx; i++) {
      cells.push({ text: "\u2014", isPlaceholder: true, colorClass: "" });
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      let colorClass = "";
      if (entry.call.type === "bid") {
        colorClass = BID_SUIT_COLOR_CLASS[entry.call.strain] ?? "";
      }
      const text = "callDisplay" in entry ? entry.callDisplay : formatCall(entry.call);
      const type = bidHistory?.[i]?.annotationType;
      const hidden = type === "educational" && !showEducationalAnnotations;
      cells.push({
        text,
        isPlaceholder: false,
        colorClass,
        bidIndex: i,
        alertLabel: hidden ? undefined : bidHistory?.[i]?.alertLabel,
        annotationType: hidden ? undefined : type,
        publicConditions: bidHistory?.[i]?.publicConditions,
      });
    }

    const result: CellData[][] = [];
    for (let i = 0; i < cells.length; i += 4) {
      result.push(cells.slice(i, i + 4));
    }
    return result;
  });

  const legendOpen = $derived(isOpen(LEGEND_ID));

  function toggleLegend(event: MouseEvent) {
    event.stopPropagation();
    if (isOpen(LEGEND_ID)) {
      requestClose(LEGEND_ID);
    } else {
      requestOpen(LEGEND_ID);
    }
  }

  $effect(() => {
    return () => requestClose(LEGEND_ID);
  });

  const px = $derived(minimal ? 'px-1' : compact ? 'px-2' : 'px-3');
  const py = $derived(minimal ? 'py-0' : compact ? 'py-0.5' : 'py-1');
  const textSize = $derived(minimal || compact ? 'text-[--text-label]' : 'text-[--text-detail]');
</script>

<div>
  {#if !minimal}
    <div class="absolute top-0 right-0 z-[calc(var(--z-tooltip)+10)]" data-auction-legend>
      <button
        class="text-text-muted/60 hover:text-text-secondary transition-colors cursor-pointer p-0.5"
        onclick={toggleLegend}
        aria-label="Annotation color legend"
        aria-expanded={legendOpen}
        data-testid="annotation-legend-toggle"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
        </svg>
      </button>
      {#if legendOpen}
        <div
          class="absolute right-0 top-full mt-1 bg-bg-card border border-border-default rounded-[--radius-md] shadow-lg p-2 text-left whitespace-nowrap text-[--text-annotation]"
          role="tooltip"
        >
          <div class="flex items-center gap-1.5 mb-1">
            <span class="inline-flex w-3.5 h-3.5 items-center justify-center rounded-full font-sans font-bold leading-none text-[--text-annotation] bg-annotation-announce/20 text-annotation-announce underline shrink-0" aria-hidden="true">A</span>
            <span class="text-annotation-announce">Announce</span>
            <span class="text-text-muted">&mdash; stated aloud</span>
          </div>
          <div class="flex items-center gap-1.5 mb-1">
            <span class="inline-flex w-3.5 h-3.5 items-center justify-center rounded-full font-sans font-bold leading-none text-[--text-annotation] bg-annotation-alert/20 text-annotation-alert shrink-0" aria-hidden="true">A</span>
            <span class="text-annotation-alert">Alert</span>
            <span class="text-text-muted">&mdash; conventional bid</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="inline-flex w-3.5 h-3.5 items-center justify-center rounded-full font-sans font-bold leading-none text-[--text-annotation] bg-text-muted/20 text-text-muted shrink-0" aria-hidden="true">i</span>
            <span class="text-text-muted">Educational</span>
            <span class="text-text-muted">&mdash; for learning</span>
          </div>
        </div>
      {/if}
    </div>
  {/if}
  <table class="w-full text-center table-fixed {textSize}" aria-label={minimal ? 'Auction summary' : undefined}>
    {#if !minimal}
      <caption class="sr-only">Auction sequence</caption>
    {/if}
    <thead>
      <tr>
        {#each SEAT_LABELS as label (label)}
          <th class="w-1/4 {px} {py} text-text-muted font-medium">{label}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, rowIdx ("row-" + rowIdx)}
        <tr class="border-t border-border-subtle">
          {#each row as cell, cellIdx (rowIdx * 4 + cellIdx)}
            <td class="{px} {py} font-mono">
              <BidBadge
                id={`auction-bid-${cell.bidIndex ?? `ph-${rowIdx}-${cellIdx}`}`}
                text={cell.text}
                isPlaceholder={cell.isPlaceholder}
                colorClass={cell.colorClass}
                alertLabel={cell.alertLabel}
                annotationType={cell.annotationType}
                publicConditions={cell.publicConditions}
                {compact}
                {minimal}
              />
            </td>
          {/each}
          {#if row.length < 4}
            {#each Array(4 - row.length) as _, padIdx (padIdx)}
              <td class="{px} {py}"></td>
            {/each}
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
