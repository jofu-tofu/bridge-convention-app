<script lang="ts">
  import type { AuctionEntry, AuctionEntryView } from "../../service";
  import type { BidHistoryEntry } from "../../service";
  import { Seat } from "../../service";
  import { SEAT_INDEX } from "../../service";
  import { formatCall } from "../../service";
  import { BID_SUIT_COLOR_CLASS } from "../shared/tokens";

  interface Props {
    entries: readonly (AuctionEntry | AuctionEntryView)[];
    dealer: Seat;
    compact?: boolean;
    /** Minimal mode: tighter padding, no legend, no annotations, no caption. Used by PlayHistoryPanel. */
    minimal?: boolean;
    /** Optional bid history with alert labels for annotation display. */
    bidHistory?: readonly BidHistoryEntry[];
    /** When false, hides gray educational annotations (keeps alerts & announcements). */
    showEducationalAnnotations?: boolean;
  }

  let { entries, dealer, compact = false, minimal = false, bidHistory, showEducationalAnnotations = true }: Props = $props();

  const SEAT_LABELS = ["N", "E", "S", "W"];

  interface CellData {
    text: string;
    isPlaceholder: boolean;
    colorClass: string;
    alertLabel?: string;
    annotationType?: "alert" | "announce" | "educational";
    meaning?: string;
    publicConditions?: readonly string[];
  }

  /** Annotation styling per ACBL type:
   *  - announce: blue (partner speaks the meaning, e.g., "15 to 17", "Transfer")
   *  - alert: amber (conventional bid requiring alert)
   *  - educational: gray (informational label for learning, not ACBL-required) */
  function annotationClass(type?: "alert" | "announce" | "educational"): string {
    switch (type) {
      case "announce": return "text-annotation-announce/80";
      case "alert": return "text-annotation-alert/80";
      default: return "text-text-muted/70";
    }
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
      // AuctionEntryView carries pre-formatted callDisplay; raw AuctionEntry uses formatCall
      const text = "callDisplay" in entry ? entry.callDisplay : formatCall(entry.call);
      if (minimal) {
        // In minimal mode, carry alertLabel for title tooltip but skip annotations/meaning
        const alertLabel = "alertLabel" in entry ? entry.alertLabel : bidHistory?.[i]?.alertLabel;
        cells.push({ text, isPlaceholder: false, colorClass, alertLabel });
      } else {
        const type = bidHistory?.[i]?.annotationType;
        const hidden = type === "educational" && !showEducationalAnnotations;
        cells.push({
          text,
          isPlaceholder: false,
          colorClass,
          alertLabel: hidden ? undefined : bidHistory?.[i]?.alertLabel,
          annotationType: hidden ? undefined : type,
          meaning: bidHistory?.[i]?.meaning,
          publicConditions: bidHistory?.[i]?.publicConditions,
        });
      }
    }

    const result: CellData[][] = [];
    for (let i = 0; i < cells.length; i += 4) {
      result.push(cells.slice(i, i + 4));
    }
    return result;
  });

  let legendOpen = $state(false);

  const px = $derived(minimal ? 'px-1' : compact ? 'px-2' : 'px-3');
  const py = $derived(minimal ? 'py-0' : compact ? 'py-0.5' : 'py-1');
  const textSize = $derived(minimal || compact ? 'text-[--text-label]' : 'text-[--text-detail]');
</script>

<div>
  {#if !minimal}
    <div class="absolute top-0 right-0 z-[calc(var(--z-tooltip)+10)]">
      <button
        class="text-text-muted/60 hover:text-text-secondary transition-colors cursor-pointer p-0.5"
        onclick={() => legendOpen = !legendOpen}
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
            <span class="w-1.5 h-1.5 rounded-full bg-annotation-announce shrink-0" aria-hidden="true"></span>
            <span class="text-annotation-announce">Announce</span>
            <span class="text-text-muted">&mdash; stated aloud</span>
          </div>
          <div class="flex items-center gap-1.5 mb-1">
            <span class="w-1.5 h-1.5 rounded-full bg-annotation-alert shrink-0" aria-hidden="true"></span>
            <span class="text-annotation-alert">Alert</span>
            <span class="text-text-muted">&mdash; conventional bid</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-text-muted shrink-0" aria-hidden="true"></span>
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
            <td
              class="{px} {py} font-mono {cell.isPlaceholder
                ? 'text-text-muted'
                : cell.colorClass || 'text-text-primary'}"
              title={minimal && cell.alertLabel ? cell.alertLabel : undefined}
            >
              {#if minimal}
                {cell.text}
              {:else}
                <div class="flex flex-col items-center">
                  <span>{cell.text}</span>
                  {#if cell.alertLabel}
                    <div class="relative group/tip inline-flex items-center gap-0.5">
                      <span
                        class="text-[--text-annotation] {annotationClass(cell.annotationType)} font-sans italic leading-tight"
                      >{cell.alertLabel}</span>
                      {#if cell.publicConditions?.length && (cell.annotationType === "alert" || cell.annotationType === "announce")}
                        <svg class="w-2.5 h-2.5 text-text-muted/50 shrink-0" xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                        </svg>
                        <div
                          class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-[var(--z-tooltip)]
                                 bg-bg-card border border-border-default rounded-[--radius-md] shadow-lg
                                 p-2 text-left whitespace-normal w-48
                                 opacity-0 group-hover/tip:opacity-100 pointer-events-none
                                 transition-opacity text-[--text-annotation]"
                          role="tooltip"
                        >
                          {#each cell.publicConditions as condition (condition)}
                            <div>{condition}</div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}
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
