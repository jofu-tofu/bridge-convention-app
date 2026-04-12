<script lang="ts">
  import { slugifyMeaningId } from "../../../service";
  import BidCode from "./BidCode.svelte";
  import type { ReferenceWorkedAuction } from "./types";

  interface Props {
    moduleId: string;
    auction: ReferenceWorkedAuction;
  }

  let { moduleId, auction }: Props = $props();
</script>

<section class="root rounded-[--radius-lg] border border-border-default bg-bg-card p-4" aria-labelledby={`worked-auction-${auction.label}`}>
  <div class="mb-4">
    <h2 id={`worked-auction-${auction.label}`} class="text-[--text-heading] font-semibold text-text-primary">
      {auction.label}
    </h2>
    {#if auction.outcomeNote}
      <p class="mt-1 text-[--text-detail] leading-6 text-text-muted">{auction.outcomeNote}</p>
    {/if}
  </div>

  <div class="overflow-x-auto">
    <table class="min-w-full border-separate border-spacing-0 text-left" aria-label={`${auction.label} worked auction`}>
      <thead>
        <tr>
          <th class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted">Seat</th>
          <th class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted">Call</th>
          <th class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted">Rationale</th>
        </tr>
      </thead>
      <tbody>
        {#each auction.calls as entry, index (`${auction.label}-${index}`)}
          <tr id={entry.meaningId ? slugifyMeaningId(moduleId, entry.meaningId) : undefined}>
            <td class="border-b border-border-subtle px-4 py-3 align-top text-[--text-body] text-text-primary">
              <span
                class="text-[--text-annotation] font-semibold uppercase tracking-[0.16em] text-text-muted"
                style="font-variant-caps: all-small-caps;"
              >
                {String(entry.seat)}
              </span>
            </td>
            <td class="border-b border-border-subtle px-4 py-3 align-top text-[--text-body] text-text-primary">
              <BidCode value={entry.call} />
            </td>
            <td class="border-b border-border-subtle px-4 py-3 align-top text-[--text-body] leading-6 text-text-secondary">
              {entry.rationale}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<style>
  @media print {
    .root {
      display: none;
    }
  }
</style>
