<script lang="ts">
  import BidCode from "./BidCode.svelte";
  import type { ReferenceInterferenceItem } from "./types";

  interface Props {
    items: readonly ReferenceInterferenceItem[];
  }

  let { items }: Props = $props();
</script>

<section class="root rounded-[--radius-lg] border border-border-default bg-bg-card p-4" aria-labelledby="interference-heading">
  <h2 id="interference-heading" class="mb-4 text-[--text-heading] font-semibold text-text-primary">
    In Competition / Interference
  </h2>

  <div class="space-y-3">
    {#each items as item (`${item.opponentAction}-${item.note}`)}
      <div class="rounded-[--radius-md] border border-border-subtle bg-bg-base/70 p-4">
        <div class="grid gap-3 lg:grid-cols-[minmax(0,12rem)_minmax(0,12rem)_minmax(0,1fr)] lg:items-start">
          <div>
            <p class="text-[--text-label] uppercase tracking-[0.12em] text-text-muted">Opponent action</p>
            <p class="mt-2 text-[--text-body] text-text-primary">
              <BidCode value={item.opponentAction} />
            </p>
          </div>
          <div>
            <p class="text-[--text-label] uppercase tracking-[0.12em] text-text-muted">Our action</p>
            <p class="mt-2 text-[--text-body] text-text-primary">
              <BidCode value={item.ourAction} />
            </p>
          </div>
          <div>
            <p class="text-[--text-label] uppercase tracking-[0.12em] text-text-muted">Note</p>
            <p class="mt-2 break-words text-[--text-body] leading-6 text-text-secondary">{item.note}</p>
          </div>
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  @media print {
    .root {
      display: none;
    }
  }
</style>
