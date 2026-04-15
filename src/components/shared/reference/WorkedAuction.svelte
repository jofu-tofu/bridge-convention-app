<script lang="ts">
  import { slugifyMeaningId } from "../../../service";
  import BidCode from "./BidCode.svelte";
  import type { ReferenceWorkedAuction } from "./types";

  interface Props {
    moduleId: string;
    auction: ReferenceWorkedAuction;
  }

  let { moduleId, auction }: Props = $props();
  // TODO(260413-1738-run-dev-open-browser Tier 3): render `auction.responderHand`
  // once the parallel learn-page UI pass wires the new worked-auction hand sample.
</script>

<section
  class="root border-border-default bg-bg-card rounded-[--radius-lg] border p-4"
  aria-labelledby={`worked-auction-${auction.label}`}
>
  <div class="mb-4">
    <h2
      id={`worked-auction-${auction.label}`}
      class="text-text-primary font-semibold text-[--text-heading]"
    >
      {auction.label}
    </h2>
  </div>

  <div class="overflow-x-auto">
    <table
      class="min-w-full border-separate border-spacing-0 text-left"
      aria-label={`${auction.label} worked auction`}
    >
      <thead>
        <tr>
          <th
            class="border-border-default text-text-muted border-b px-4 py-3 tracking-[0.12em] text-[--text-label] uppercase"
            >Seat</th
          >
          <th
            class="border-border-default text-text-muted border-b px-4 py-3 tracking-[0.12em] text-[--text-label] uppercase"
            >Call</th
          >
          <th
            class="border-border-default text-text-muted border-b px-4 py-3 tracking-[0.12em] text-[--text-label] uppercase"
            >Rationale</th
          >
        </tr>
      </thead>
      <tbody>
        {#each auction.calls as entry, index (`${auction.label}-${index}`)}
          <tr
            id={entry.meaningId
              ? slugifyMeaningId(moduleId, entry.meaningId)
              : undefined}
          >
            <td
              class="border-border-subtle text-text-primary border-b px-4 py-3 align-top text-[--text-body]"
            >
              <span
                class="text-text-muted font-semibold tracking-[0.16em] text-[--text-annotation] uppercase"
                style="font-variant-caps: all-small-caps;"
              >
                {String(entry.seat)}
              </span>
            </td>
            <td
              class="border-border-subtle text-text-primary border-b px-4 py-3 align-top text-[--text-body]"
            >
              <BidCode value={entry.call} />
            </td>
            <td
              class="border-border-subtle text-text-secondary border-b px-4 py-3 align-top leading-6 text-[--text-body]"
            >
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
