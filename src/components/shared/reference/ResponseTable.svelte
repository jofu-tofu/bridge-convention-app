<script lang="ts">
  import { slugifyMeaningId } from "../../../service";
  import BidCode from "./BidCode.svelte";
  import type { ReferenceForcingToken, ReferenceResponseTableRow } from "./types";

  interface Props {
    moduleId: string;
    rows: readonly ReferenceResponseTableRow[];
  }

  let { moduleId, rows }: Props = $props();

  const forcingBadgeClass: Record<ReferenceForcingToken, string> = {
    NF: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    INV: "border-amber-400/40 bg-amber-500/10 text-amber-100",
    F1: "border-rose-400/40 bg-rose-500/10 text-rose-100",
    GF: "border-sky-400/40 bg-sky-500/10 text-sky-100",
  };
</script>

<section class="root rounded-[--radius-lg] border border-border-default bg-bg-card p-4" aria-labelledby="response-table-heading">
  <div class="mb-4 flex items-center justify-between gap-3">
    <h2 id="response-table-heading" class="text-[--text-heading] font-semibold text-text-primary">
      Response Table
    </h2>
    <span class="text-[--text-label] uppercase tracking-[0.12em] text-text-muted">
      Reference Spine
    </span>
  </div>

  <div class="overflow-x-auto">
    <table class="min-w-full border-separate border-spacing-0 text-left" aria-label="Convention response table">
      <thead>
        <tr>
          <th class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted">Response</th>
          <th class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted">Meaning</th>
          <th class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted">Shape</th>
          <th class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted">HCP</th>
          <th class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted">Forcing?</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.meaningId)}
          <tr id={slugifyMeaningId(moduleId, row.meaningId)} class="scroll-mt-24">
            <td class="border-b border-border-subtle px-4 py-3 align-top text-[--text-body] text-text-primary">
              <BidCode value={row.response} />
            </td>
            <td class="border-b border-border-subtle px-4 py-3 align-top text-[--text-body] leading-6 text-text-primary">{row.meaning}</td>
            <td class="border-b border-border-subtle px-4 py-3 align-top text-[--text-body] leading-6 text-text-secondary">{row.shape}</td>
            <td class="border-b border-border-subtle px-4 py-3 align-top text-[--text-body] leading-6 text-text-secondary">{row.hcp}</td>
            <td class="border-b border-border-subtle px-4 py-3 align-top text-[--text-body] text-text-primary">
              {#if row.forcing}
                <span class={`inline-flex rounded-full border px-2 py-1 text-[--text-annotation] font-semibold uppercase tracking-[0.08em] ${forcingBadgeClass[row.forcing]}`.trim()}>
                  {row.forcing}
                </span>
              {/if}
            </td>
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
