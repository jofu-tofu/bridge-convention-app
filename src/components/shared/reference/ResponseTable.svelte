<script lang="ts">
  import { slugifyMeaningId } from "../../../service";
  import BidCode from "./BidCode.svelte";
  import type { ReferenceResponseTable } from "./types";

  interface Props {
    moduleId: string;
    responseTable: ReferenceResponseTable;
  }

  let { moduleId, responseTable }: Props = $props();
</script>

<section
  class="root rounded-[--radius-lg] border border-border-default bg-bg-card p-4"
  aria-labelledby="response-table-heading"
>
  <div class="mb-4 flex items-center justify-between gap-3">
    <h2 id="response-table-heading" class="text-[--text-heading] font-semibold text-text-primary">
      Response Table
    </h2>
    <span class="text-[--text-label] uppercase tracking-[0.12em] text-text-muted">
      Reference Spine
    </span>
  </div>

  <div class="overflow-x-auto">
    <table
      class="min-w-full border-separate border-spacing-0 text-left"
      aria-label="Convention response table"
    >
      <thead>
        <tr>
          <th
            class="w-px whitespace-nowrap border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted"
            scope="col"
          >
            Response
          </th>
          <th
            class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted"
            scope="col"
          >
            Meaning
          </th>
          {#each responseTable.columns as col (col.id)}
            <th
              class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted"
              scope="col"
            >
              {col.label}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each responseTable.rows as row (row.meaningId)}
          <tr id={slugifyMeaningId(moduleId, row.meaningId)} class="scroll-mt-24">
            <td
              class="w-px whitespace-nowrap border-b border-border-subtle px-4 py-3 align-top text-[--text-body] text-text-primary"
            >
              <BidCode value={row.response} />
            </td>
            <td
              class="border-b border-border-subtle px-4 py-3 align-top text-[--text-body] leading-6 text-text-primary"
            >
              {row.meaning}
            </td>
            {#each responseTable.columns as col (col.id)}
              {@const cell = row.cells.find((c) => c.columnId === col.id)}
              <td
                class="border-b border-border-subtle px-4 py-3 align-top text-[--text-body] leading-6 text-text-secondary"
              >
                {cell?.text ?? ""}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<style>
  .root {
    break-inside: avoid;
  }
</style>
