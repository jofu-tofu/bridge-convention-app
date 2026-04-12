<script lang="ts">
  import { MODULE_CATEGORIES } from "../module-catalog";
  import BidCode from "./BidCode.svelte";
  import type { ReferenceSummaryCard } from "./types";

  interface Props {
    moduleId: string;
    summaryCard: ReferenceSummaryCard;
  }

  let { moduleId, summaryCard }: Props = $props();

  const categoryAccentClass: Record<string, string> = {
    "Notrump Responses": "border-l-sky-400 bg-sky-500/5",
    "Major Raises": "border-l-emerald-400 bg-emerald-500/5",
    Competitive: "border-l-rose-400 bg-rose-500/5",
    "Opening Bids": "border-l-indigo-400 bg-indigo-500/5",
    Slam: "border-l-amber-400 bg-amber-500/5",
    "Weak Bids": "border-l-violet-400 bg-violet-500/5",
    "Responder Rebids": "border-l-cyan-400 bg-cyan-500/5",
    Other: "border-l-slate-400 bg-slate-500/5",
  };

  const category = $derived(MODULE_CATEGORIES[moduleId] ?? "Other");
  const accentClass = $derived(categoryAccentClass[category] ?? categoryAccentClass.Other);

  const lines = $derived([
    { label: "Trigger", value: summaryCard.trigger },
    { label: "Convention bid", value: summaryCard.bid, isBid: true },
    { label: "Promises", value: summaryCard.promises },
    { label: "Denies", value: summaryCard.denies },
    { label: "Guiding idea", value: summaryCard.guidingIdea },
    { label: "Partnership", value: summaryCard.partnership },
  ]);
</script>

<section
  class={`root rounded-[--radius-lg] border border-border-default border-l-4 p-4 shadow-sm ${accentClass}`.trim()}
  aria-labelledby="summary-card-heading"
>
  <div class="mb-3 flex items-center justify-between gap-3">
    <h2 id="summary-card-heading" class="text-[--text-heading] font-semibold text-text-primary">
      Summary Card
    </h2>
    <span class="rounded-full border border-border-default px-2 py-1 text-[--text-annotation] uppercase tracking-[0.12em] text-text-muted">
      {category}
    </span>
  </div>

  <dl class="divide-y divide-border-subtle">
    {#each lines as line (line.label)}
      <div class="grid gap-2 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-start">
        <dt class="text-[--text-label] font-semibold uppercase tracking-[0.12em] text-text-muted">
          {line.label}
        </dt>
        <dd class="min-w-0 break-words text-[--text-body] leading-6 text-text-primary">
          {#if line.isBid}
            <BidCode value={line.value} />
          {:else}
            {line.value}
          {/if}
        </dd>
      </div>
    {/each}
  </dl>
</section>

<style>
  .root {
    break-inside: avoid;
  }
</style>
