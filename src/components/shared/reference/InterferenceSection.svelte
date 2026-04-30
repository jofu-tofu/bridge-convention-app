<script lang="ts">
  import BidCode from "./BidCode.svelte";
  import type { ReferenceInterference } from "./types";

  interface Props {
    interference: ReferenceInterference;
  }

  let { interference }: Props = $props();
</script>

<section
  class="root rounded-[--radius-lg] border border-border-default bg-bg-card p-4"
  aria-labelledby="interference-heading"
>
  <h2 id="interference-heading" class="mb-4 text-[--text-heading] font-semibold text-text-primary">
    In Competition / Interference
  </h2>

  {#if interference.status === "notApplicable"}
    <p class="text-[--text-body] leading-6 text-text-secondary">
      No interference guidance for this convention ({interference.reason}).
    </p>
  {:else}
    <table class="interference-table">
      <colgroup>
        <col class="col-bid" />
        <col class="col-action" />
        <col class="col-note" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Opponent action</th>
          <th scope="col">Our action</th>
          <th scope="col">Note</th>
        </tr>
      </thead>
      <tbody>
        {#each interference.items as item (`${item.opponentAction}-${item.note}`)}
          <tr>
            <td><BidCode value={item.opponentAction} /></td>
            <td><BidCode value={item.ourAction} /></td>
            <td class="note-cell">{item.note}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<style>
  .interference-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
  }

  .col-bid {
    width: 1%;
    white-space: nowrap;
  }

  .col-action {
    width: 1%;
    white-space: nowrap;
  }

  .col-note {
    width: auto;
  }

  .interference-table thead th {
    text-align: left;
    padding: 0.5rem 0.75rem;
    font-size: var(--text-label);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--color-text-muted);
    border-bottom: 1px solid var(--color-border-subtle);
    white-space: nowrap;
  }

  .interference-table tbody td {
    padding: 0.75rem;
    font-size: var(--text-body);
    color: var(--color-text-primary);
    vertical-align: top;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .interference-table tbody tr:last-child td {
    border-bottom: 0;
  }

  .interference-table .note-cell {
    color: var(--color-text-secondary);
    line-height: 1.5;
    overflow-wrap: break-word;
  }

  @media print {
    .root {
      display: none;
    }
  }
</style>
