<script lang="ts">
  import BidCode from "./BidCode.svelte";
  import type { ReferenceActionFamily, ReferenceDecisionGrid } from "./types";

  interface Props {
    decisionGrid: ReferenceDecisionGrid | null;
  }

  let { decisionGrid }: Props = $props();

  const familyClass: Record<ReferenceActionFamily, string> = {
    signoff: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
    invite: "border-amber-400/40 bg-amber-500/10 text-amber-100",
    force: "border-rose-400/40 bg-rose-500/10 text-rose-100",
    asking: "border-sky-400/40 bg-sky-500/10 text-sky-100",
    competitive: "border-violet-400/40 bg-violet-500/10 text-violet-100",
    other: "border-border-default bg-bg-card text-text-secondary",
  };

  const familyLabel: Record<ReferenceActionFamily, string> = {
    signoff: "Signoff",
    invite: "Invite",
    force: "Force",
    asking: "Asking",
    competitive: "Competitive",
    other: "Other",
  };
</script>

{#if decisionGrid}
  <section class="root rounded-[--radius-lg] border border-border-default bg-bg-card p-4" aria-labelledby="decision-grid-heading">
    <div class="mb-4">
      <h2 id="decision-grid-heading" class="text-[--text-heading] font-semibold text-text-primary">
        Decision Grid
      </h2>
      <p class="mt-1 text-[--text-detail] leading-6 text-text-muted">
        Read down the HCP axis and across the shape axis to locate the recommended action.
      </p>
    </div>

    <div class="overflow-x-auto">
      <table class="min-w-full border-separate border-spacing-0 text-left" aria-label="Decision grid">
        <thead>
          <tr>
            <th class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted"></th>
            {#each decisionGrid.cols as col (col.label)}
              <th class="border-b border-border-default px-4 py-3 text-[--text-body] font-semibold text-text-primary">
                {col.label}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each decisionGrid.rows as row, rowIndex (row.label)}
            <tr>
              <th class="border-b border-border-subtle px-4 py-4 text-[--text-body] font-semibold text-text-primary">
                {row.label}
              </th>
              {#each decisionGrid.cells[rowIndex] ?? [] as cell, colIndex (`${row.label}-${colIndex}`)}
                <td class="border-b border-border-subtle px-4 py-4 align-top">
                  {#if cell}
                    <div class="min-w-36 space-y-2 rounded-[--radius-md] border border-border-subtle bg-bg-base/70 p-3">
                      <BidCode value={cell.bid} />
                      <p class="text-[--text-detail] leading-6 text-text-primary">{cell.meaning}</p>
                      <span class={`inline-flex rounded-full border px-2 py-1 text-[--text-annotation] uppercase tracking-[0.08em] ${familyClass[cell.family ?? "other"]}`.trim()}>
                        {familyLabel[cell.family ?? "other"]}
                      </span>
                      {#if cell.note}
                        <p class="text-[--text-detail] leading-6 text-text-muted">{cell.note}</p>
                      {/if}
                    </div>
                  {:else}
                    <span class="text-[--text-body] text-text-muted">&mdash;</span>
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}

<style>
  @media print {
    .root {
      display: none;
    }
  }
</style>
