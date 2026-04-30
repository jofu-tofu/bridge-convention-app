<script lang="ts">
  import { slugifyMeaningId } from "../../../service";
  import BidCode from "./BidCode.svelte";
  import ReferenceHandDiagram from "./ReferenceHandDiagram.svelte";
  import type { ReferenceWorkedAuction } from "./types";

  interface Props {
    moduleId: string;
    auction: ReferenceWorkedAuction;
  }

  let { moduleId, auction }: Props = $props();
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

  <div class="space-y-3">
    {#if auction.responderHand}
      <ReferenceHandDiagram
        hand={auction.responderHand}
        label={`Responder hand for ${auction.label}`}
      />
    {/if}
    <div class="overflow-x-auto">
      <table
        class="min-w-full border-separate border-spacing-0 text-left"
        aria-label={`${auction.label} worked auction`}
      >
        <thead>
          <tr>
            <th
              class="border-border-default text-text-muted w-px whitespace-nowrap border-b px-4 py-3 tracking-[0.12em] text-[--text-label] uppercase"
              >Seat</th
            >
            <th
              class="border-border-default text-text-muted w-px whitespace-nowrap border-b px-4 py-3 tracking-[0.12em] text-[--text-label] uppercase"
              >Call</th
            >
            <th
              class="border-border-default text-text-muted w-full border-b px-4 py-3 tracking-[0.12em] text-[--text-label] uppercase"
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
                class="border-border-subtle text-text-primary w-px whitespace-nowrap border-b px-4 py-3 align-top text-[--text-body]"
              >
                <span
                  class="text-text-muted font-semibold tracking-[0.16em] text-[--text-annotation] uppercase"
                  style="font-variant-caps: all-small-caps;"
                >
                  {String(entry.seat)}
                </span>
              </td>
              <td
                class="border-border-subtle text-text-primary w-px whitespace-nowrap border-b px-4 py-3 align-top text-[--text-body]"
              >
                <BidCode value={entry.call} />
              </td>
              <td
                class="border-border-subtle text-text-secondary w-full border-b px-4 py-3 align-top leading-6 text-[--text-body]"
              >
                {entry.rationale}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</section>

<style>
  @media print {
    .root {
      display: none;
    }
  }
</style>
