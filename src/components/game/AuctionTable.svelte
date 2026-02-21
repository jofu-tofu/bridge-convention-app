<script lang="ts">
  import type { AuctionEntry } from "../../engine/types";
  import { Seat, BidSuit } from "../../engine/types";
  import { SEAT_INDEX } from "../../engine/constants";
  import { formatCall } from "../../lib/format";
  import { BID_SUIT_COLOR_CLASS } from "../../lib/tokens";

  interface Props {
    entries: readonly AuctionEntry[];
    dealer: Seat;
    compact?: boolean;
  }

  let { entries, dealer, compact = false }: Props = $props();

  const SEAT_LABELS = ["N", "E", "S", "W"];

  interface CellData {
    text: string;
    isPlaceholder: boolean;
    colorClass: string;
  }

  const rows = $derived.by(() => {
    const dealerIdx = SEAT_INDEX[dealer];
    const cells: CellData[] = [];

    for (let i = 0; i < dealerIdx; i++) {
      cells.push({ text: "\u2014", isPlaceholder: true, colorClass: "" });
    }

    for (const entry of entries) {
      let colorClass = "";
      if (entry.call.type === "bid") {
        colorClass = BID_SUIT_COLOR_CLASS[entry.call.strain] ?? "";
      }
      cells.push({ text: formatCall(entry.call), isPlaceholder: false, colorClass });
    }

    const result: CellData[][] = [];
    for (let i = 0; i < cells.length; i += 4) {
      result.push(cells.slice(i, i + 4));
    }
    return result;
  });
</script>

<div class="overflow-x-auto">
  <table class="w-full text-center {compact ? 'text-xs' : 'text-sm'}">
    <thead>
      <tr>
        {#each SEAT_LABELS as label (label)}
          <th class="px-3 {compact ? 'py-0.5' : 'py-1'} text-text-muted font-medium">{label}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, rowIdx ('row-' + rowIdx)}
        <tr class="border-t border-border-subtle">
          {#each row as cell, cellIdx (rowIdx * 4 + cellIdx)}
            <td class="px-3 {compact ? 'py-0.5' : 'py-1'} font-mono {cell.isPlaceholder ? 'text-text-muted' : cell.colorClass || 'text-text-primary'}">
              {cell.text}
            </td>
          {/each}
          {#if row.length < 4}
            {#each Array(4 - row.length) as _, padIdx (padIdx)}
              <td class="px-3 {compact ? 'py-0.5' : 'py-1'}"></td>
            {/each}
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
