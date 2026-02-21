<script lang="ts">
  import type { AuctionEntry } from "../engine/types";
  import { Seat } from "../engine/types";
  import { SEATS, SEAT_INDEX } from "../engine/constants";
  import { formatCall } from "../lib/format";

  interface Props {
    entries: readonly AuctionEntry[];
    dealer: Seat;
  }

  let { entries, dealer }: Props = $props();

  const SEAT_LABELS = ["N", "E", "S", "W"];

  interface CellData {
    text: string;
    isPlaceholder: boolean;
  }

  const rows = $derived.by(() => {
    const dealerIdx = SEAT_INDEX[dealer];
    const cells: CellData[] = [];

    // Add dashes for seats before dealer in the first row
    for (let i = 0; i < dealerIdx; i++) {
      cells.push({ text: "—", isPlaceholder: true });
    }

    // Add actual bids
    for (const entry of entries) {
      cells.push({ text: formatCall(entry.call), isPlaceholder: false });
    }

    // Group into rows of 4
    const result: CellData[][] = [];
    for (let i = 0; i < cells.length; i += 4) {
      result.push(cells.slice(i, i + 4));
    }
    return result;
  });
</script>

<div class="overflow-x-auto">
  <table class="w-full text-center text-sm">
    <thead>
      <tr>
        {#each SEAT_LABELS as label (label)}
          <th class="px-3 py-1 text-gray-400 font-medium">{label}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, rowIdx (rowIdx)}
        <tr>
          {#each row as cell, cellIdx (rowIdx * 4 + cellIdx)}
            <td class="px-3 py-1 {cell.isPlaceholder ? 'text-gray-600' : 'text-gray-200'}">
              {cell.text}
            </td>
          {/each}
          {#if row.length < 4}
            {#each Array(4 - row.length) as _, padIdx (padIdx)}
              <td class="px-3 py-1"></td>
            {/each}
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
