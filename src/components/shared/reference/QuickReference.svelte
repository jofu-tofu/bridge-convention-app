<script lang="ts">
  import type { ReferenceQuickReference } from "./types";

  interface Props {
    quickReference: ReferenceQuickReference;
  }

  let { quickReference }: Props = $props();

  const isDenseGrid = $derived.by(() => {
    if (quickReference.kind !== "grid") return false;
    const cells = quickReference.cells.flat();
    if (cells.length === 0) return false;
    const notApplicableCount = cells.filter((cell) => cell.kind === "notApplicable").length;
    return notApplicableCount / cells.length > 0.5;
  });
</script>

<section
  class="root rounded-[--radius-lg] border border-border-default bg-bg-card p-4"
  aria-labelledby="quick-reference-heading"
>
  <div class="mb-4">
    <h2 id="quick-reference-heading" class="text-[--text-heading] font-semibold text-text-primary">
      Quick Reference
    </h2>
  </div>

  {#if quickReference.kind === "grid"}
    <div class="overflow-x-auto">
      <table
        data-testid="quick-reference-grid"
        data-density={isDenseGrid ? "dense" : "balanced"}
        class="min-w-full border-separate border-spacing-0 text-left"
        aria-label="Quick reference grid"
      >
        <caption class="mb-2 text-left text-[--text-detail] leading-6 text-text-muted">
          {quickReference.rowAxis.label} × {quickReference.colAxis.label}
        </caption>
        <thead>
          <tr>
            <th
              class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted"
              scope="col"
            >
              {quickReference.rowAxis.label}
            </th>
            {#each quickReference.colAxis.values as col, colIndex (`col-${colIndex}`)}
              <th
                class="border-b border-border-default px-4 py-3 text-[--text-body] font-semibold text-text-primary"
                scope="col"
              >
                {col}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each quickReference.rowAxis.values as row, rowIndex (`row-${rowIndex}`)}
            <tr>
              <th
                class="border-b border-border-subtle px-4 py-4 text-[--text-body] font-semibold text-text-primary"
                scope="row"
              >
                {row}
              </th>
              {#each quickReference.cells[rowIndex] ?? [] as cell, colIndex (`${rowIndex}-${colIndex}`)}
                <td
                  class="qr-cell border-b border-border-subtle px-4 py-4 align-top text-[--text-body] leading-6 text-text-primary"
                  class:qr-cell-dense={isDenseGrid}
                  class:qr-cell-live={cell.kind === "action"}
                  class:qr-cell-unavailable={cell.kind === "notApplicable"}
                  title={cell.notApplicableReasonText ?? undefined}
                >
                  {#if cell.kind === "notApplicable" && cell.notApplicableReasonText}
                    <details class="qr-unavailable">
                      <summary aria-label="Show why this cell is unavailable">
                        <span class="qr-unavailable-call" aria-hidden="true">{cell.call}</span>
                        <span class="sr-only">Show why this cell is unavailable</span>
                      </summary>
                      <div class="qr-unavailable-note">{cell.notApplicableReasonText}</div>
                    </details>
                  {:else}
                    <div
                      class="qr-call font-semibold"
                      class:text-text-primary={cell.kind === "action"}
                      class:text-text-muted={cell.kind !== "action"}
                    >
                      {cell.call}
                    </div>
                  {/if}
                  {#if cell.gloss}
                    <div class="mt-1 text-[--text-detail] leading-5 text-text-secondary">
                      {cell.gloss}
                    </div>
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table
        class="w-full table-fixed border-separate border-spacing-0 text-left"
        aria-label="Quick reference list"
      >
        <colgroup>
          <col style="width: 22%" />
          <col style="width: 40%" />
          <col style="width: 38%" />
        </colgroup>
        <caption class="mb-2 text-left text-[--text-detail] leading-6 text-text-muted">
          {quickReference.axis.label}
        </caption>
        <thead>
          <tr>
            <th
              class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted"
              scope="col"
            >
              {quickReference.axis.label}
            </th>
            <th
              class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted"
              scope="col"
            >
              Recommendation
            </th>
            <th
              class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted"
              scope="col"
            >
              Note
            </th>
          </tr>
        </thead>
        <tbody>
          {#each quickReference.items as item, i (`item-${i}`)}
            <tr>
              <th
                class="border-b border-border-subtle px-4 py-3 text-[--text-body] font-semibold text-text-primary"
                scope="row"
              >
                {quickReference.axis.values[i] ?? ""}
              </th>
              <td
                class="border-b border-border-subtle px-4 py-3 align-top text-[--text-body] text-text-primary"
              >
                {item.recommendation}
              </td>
              <td
                class="border-b border-border-subtle px-4 py-3 align-top text-[--text-body] leading-6 text-text-secondary"
              >
                {item.note}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .qr-cell-live {
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--color-bg-card) 70%, white 10%), transparent),
      color-mix(in srgb, var(--color-bg-card) 96%, transparent);
  }

  .qr-cell-unavailable {
    background: color-mix(in srgb, var(--color-bg-base) 88%, transparent);
  }

  .qr-cell-dense {
    padding-top: 0.65rem;
    padding-bottom: 0.65rem;
  }

  .qr-cell-dense.qr-cell-unavailable {
    padding-top: 0.45rem;
    padding-bottom: 0.45rem;
  }

  .qr-call {
    display: inline-flex;
    align-items: center;
    min-height: 1.75rem;
  }

  .qr-cell-live .qr-call {
    padding: 0.2rem 0.55rem;
    border-radius: 9999px;
    border: 1px solid color-mix(in srgb, var(--color-accent-primary) 25%, transparent);
    background: color-mix(in srgb, var(--color-accent-primary) 10%, transparent);
  }

  .qr-unavailable {
    display: inline-block;
  }

  .qr-unavailable summary {
    list-style: none;
    cursor: pointer;
  }

  .qr-unavailable summary::-webkit-details-marker {
    display: none;
  }

  .qr-unavailable-call {
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .qr-unavailable-note {
    margin-top: 0.35rem;
    max-width: 14rem;
    color: var(--color-text-muted);
    font-size: var(--text-detail, 0.875rem);
    line-height: 1.4;
  }

  @media print {
    .root {
      display: none;
    }
  }
</style>
