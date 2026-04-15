<script lang="ts">
  import { MODULE_CATEGORIES } from "../module-catalog";
  import { slugifyMeaningId } from "../../../service";
  import BidCode from "./BidCode.svelte";
  import type { ReferenceSummaryCard, ReferenceSummaryCardPeer } from "./types";

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

  const peers = $derived<readonly ReferenceSummaryCardPeer[]>(summaryCard.peers ?? []);
  const hasPeers = $derived(peers.length >= 2);

  const lines = $derived([
    { label: "Trigger", value: summaryCard.trigger },
    { label: "Convention bid", value: summaryCard.bid, isBid: true },
    { label: "Promises", value: summaryCard.promises },
    { label: "Denies", value: summaryCard.denies },
    { label: "Guiding idea", value: summaryCard.guidingIdea },
    { label: "Partnership", value: summaryCard.partnership },
  ]);

  const heroLines = $derived([
    { label: "Trigger", value: summaryCard.trigger },
    { label: "Guiding idea", value: summaryCard.guidingIdea },
    { label: "Partnership", value: summaryCard.partnership },
  ]);

  function peerAriaLabel(peer: ReferenceSummaryCardPeer): string {
    return `${peer.callDisplay} — ${peer.discriminatorLabel}`;
  }
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

  {#if hasPeers}
    <dl class="divide-y divide-border-subtle">
      {#each heroLines as line (line.label)}
        {#if typeof line.value === "string" && line.value.trim() !== ""}
          <div class="grid gap-2 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-start">
            <dt class="text-[--text-label] font-semibold uppercase tracking-[0.12em] text-text-muted">
              {line.label}
            </dt>
            <dd class="min-w-0 break-words text-[--text-body] leading-6 text-text-primary">
              {line.value}
            </dd>
          </div>
        {/if}
      {/each}
    </dl>

    <div class="peer-grid mt-4 grid gap-3 md:grid-cols-2">
      {#each peers as peer (peer.meaningId)}
        <a
          class="peer-tile block rounded-[--radius-md] border border-border-subtle bg-bg-card/80 p-3 no-underline transition hover:border-border-default focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          href={`#${slugifyMeaningId(moduleId, peer.meaningId)}`}
          aria-label={peerAriaLabel(peer)}
          data-testid={`summary-peer-${peer.meaningId}`}
        >
          <div class="peer-tile__bid">
            <BidCode value={peer.call} />
          </div>
          <div class="peer-tile__label mt-1 text-[--text-label] font-semibold uppercase tracking-[0.08em] text-text-muted">
            {peer.discriminatorLabel}
          </div>
          {#if peer.promises.trim() !== ""}
            <div class="mt-2 text-[--text-body] leading-6 text-text-primary">
              <span class="text-[--text-label] font-semibold uppercase tracking-[0.08em] text-text-muted">Promises.</span>
              {peer.promises}
            </div>
          {/if}
          {#if peer.denies.trim() !== ""}
            <div class="mt-1 text-[--text-body] leading-6 text-text-primary">
              <span class="text-[--text-label] font-semibold uppercase tracking-[0.08em] text-text-muted">Denies.</span>
              {peer.denies}
            </div>
          {/if}
        </a>
      {/each}
    </div>
  {:else}
    <div class="hero-bid-panel mb-4 rounded-[--radius-md] border border-border-subtle bg-bg-card/80 p-4">
      <p class="hero-bid-label">Convention bid</p>
      <div
        class="hero-bid"
        data-testid="summary-hero-bid"
        aria-label="Convention bid"
      >
        <BidCode value={summaryCard.bid} />
      </div>
    </div>

    <dl class="divide-y divide-border-subtle">
      {#each lines as line (line.label)}
        {#if line.isBid || (typeof line.value === "string" && line.value.trim() !== "")}
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
        {/if}
      {/each}
    </dl>
  {/if}
</section>

<style>
  .root {
    break-inside: avoid;
  }

  .hero-bid-panel {
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--color-bg-card) 78%, white 6%), transparent),
      color-mix(in srgb, var(--color-bg-card) 92%, transparent);
  }

  .hero-bid-label {
    margin: 0 0 0.5rem;
    font-size: var(--text-label, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .hero-bid :global(span) {
    font-size: clamp(2.75rem, 8vw, 4.75rem);
    line-height: 0.95;
  }

  .peer-tile {
    break-inside: avoid;
  }

  .peer-tile__bid :global(span) {
    font-size: clamp(2rem, 5vw, 3rem);
    line-height: 1;
  }
</style>
