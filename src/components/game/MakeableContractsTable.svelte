<script lang="ts">
  import { Seat, BidSuit } from "../../engine/types";
  import { BID_SUIT_COLOR_CLASS } from "../../lib/tokens";
  import { STRAIN_SYMBOLS } from "../../lib/format";

  interface Props {
    tricks: Record<Seat, Record<BidSuit, number>>;
  }

  let { tricks }: Props = $props();

  const SEATS = [Seat.North, Seat.East, Seat.South, Seat.West] as const;
  const STRAINS = [
    BidSuit.NoTrump,
    BidSuit.Spades,
    BidSuit.Hearts,
    BidSuit.Diamonds,
    BidSuit.Clubs,
  ] as const;
</script>

<table class="w-full text-sm border-collapse table-fixed">
  <caption class="sr-only">Makeable contracts by declarer and strain</caption>
  <thead>
    <tr>
      <th class="p-1.5 text-text-muted font-medium text-left"></th>
      {#each SEATS as seat (seat)}
        <th class="p-1.5 text-text-secondary font-medium text-center">{seat}</th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each STRAINS as strain (strain)}
      <tr class="border-t border-border-subtle">
        <td class="p-1.5 font-semibold {BID_SUIT_COLOR_CLASS[strain]}">
          {STRAIN_SYMBOLS[strain]}
        </td>
        {#each SEATS as seat (seat)}
          {@const count = tricks[seat]?.[strain] ?? 0}
          <td
            class="p-1.5 text-center font-mono {count >= 7
              ? 'text-green-400'
              : 'text-text-muted'}"
          >
            {count}
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>
