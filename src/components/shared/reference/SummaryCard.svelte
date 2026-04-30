<script lang="ts">
  import { MODULE_CATEGORIES } from "../module-catalog";
  import { slugifyMeaningId } from "../../../service";
  import BidCode from "./BidCode.svelte";
  import type {
    ReferenceBid,
    ReferenceSummaryCard,
    ReferenceSummaryCardPeer,
    ReferenceSummaryCardStyleVariant,
  } from "./types";

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

  interface BidTile {
    readonly key: string;
    readonly call: ReferenceBid;
    readonly discriminatorLabel: string | null;
    readonly promises: string;
    readonly denies: string;
    readonly href: string | null;
    readonly ariaLabel: string;
    readonly testId: string;
  }

  const peers = $derived<readonly ReferenceSummaryCardPeer[]>(summaryCard.peers ?? []);

  const tiles = $derived<readonly BidTile[]>(
    peers.length >= 2
      ? peers.map(
          (peer): BidTile => ({
            key: peer.meaningId,
            call: peer.call,
            discriminatorLabel: peer.discriminatorLabel,
            promises: peer.promises,
            denies: peer.denies,
            href: `#${slugifyMeaningId(moduleId, peer.meaningId)}`,
            ariaLabel: `${peer.callDisplay} — ${peer.discriminatorLabel}`,
            testId: `summary-peer-${peer.meaningId}`,
          }),
        )
      : [
          {
            key: "hero",
            call: summaryCard.bid,
            discriminatorLabel: null,
            promises: summaryCard.promises,
            denies: summaryCard.denies,
            href: null,
            ariaLabel: "Convention bid",
            testId: "summary-hero-bid",
          },
        ],
  );

  const isMulti = $derived(tiles.length >= 2);

  const heroLines = $derived([
    { label: "Trigger", value: summaryCard.trigger },
    { label: "Guiding idea", value: summaryCard.guidingIdea },
    { label: "Agreement note", value: summaryCard.agreementNote },
  ]);

  const styleVariants = $derived<readonly ReferenceSummaryCardStyleVariant[]>(
    summaryCard.styleVariants ?? [],
  );
</script>

<section
  class={`root rounded-[--radius-lg] border border-border-default border-l-4 p-4 shadow-sm ${accentClass}`.trim()}
  aria-labelledby="summary-card-heading"
>
  <div class="summary-header mb-3 flex items-center justify-between gap-3">
    <h2 id="summary-card-heading" class="text-[--text-heading] font-semibold text-text-primary">
      Summary Card
    </h2>
    <span class="summary-category rounded-full border border-border-default px-2 py-1 text-[--text-annotation] uppercase tracking-[0.12em] text-text-muted">
      {category}
    </span>
  </div>

  <dl class="divide-y divide-border-subtle">
    {#each heroLines as line (line.label)}
      {#if typeof line.value === "string" && line.value.trim() !== ""}
        <div class="summary-row grid gap-2 py-3">
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

  {#if styleVariants.length > 0}
    <section
      class="style-variants mt-3 rounded-[--radius-md] border border-border-subtle bg-bg-card/40 p-3"
      aria-label="Style variants"
      data-testid="summary-style-variants"
    >
      <h3 class="mb-2 text-[--text-label] font-semibold uppercase tracking-[0.12em] text-text-muted">
        Style variants
      </h3>
      <dl class="grid gap-2">
        {#each styleVariants as variant (variant.name)}
          <div class="grid gap-1">
            <dt class="text-[--text-body] font-semibold text-text-primary">
              {variant.name}
            </dt>
            <dd class="min-w-0 break-words text-[--text-body] leading-6 text-text-primary">
              {variant.description}
            </dd>
          </div>
        {/each}
      </dl>
    </section>
  {/if}

  <div
    class="bids-grid mt-4 grid gap-3"
    class:md-multi={isMulti}
    class:bids-grid--single={!isMulti}
  >
    {#each tiles as tile (tile.key)}
      {#if tile.href}
        <a
          class="bid-tile block rounded-[--radius-md] border border-border-subtle bg-bg-card/80 p-3 no-underline transition hover:border-border-default focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          href={tile.href}
          aria-label={tile.ariaLabel}
          data-testid={tile.testId}
        >
          {#if tile.discriminatorLabel}
            <p class="bid-tile__label">Convention bid — {tile.discriminatorLabel}</p>
          {:else}
            <p class="bid-tile__label">Convention bid</p>
          {/if}
          <div class="bid-tile__bid" class:bid-tile__bid--hero={!isMulti}>
            <BidCode value={tile.call} />
          </div>
          {#if tile.promises.trim() !== ""}
            <div class="mt-2 text-[--text-body] leading-6 text-text-primary">
              <span class="text-[--text-label] font-semibold uppercase tracking-[0.08em] text-text-muted">Promises.</span>
              {tile.promises}
            </div>
          {/if}
          {#if tile.denies.trim() !== ""}
            <div class="mt-1 text-[--text-body] leading-6 text-text-primary">
              <span class="text-[--text-label] font-semibold uppercase tracking-[0.08em] text-text-muted">Denies.</span>
              {tile.denies}
            </div>
          {/if}
        </a>
      {:else}
        <div
          class="bid-tile block rounded-[--radius-md] border border-border-subtle bg-bg-card/80 p-4"
          aria-label={tile.ariaLabel}
          data-testid={tile.testId}
        >
          <p class="bid-tile__label">Convention bid</p>
          <div class="bid-tile__bid bid-tile__bid--hero">
            <BidCode value={tile.call} />
          </div>
          {#if tile.promises.trim() !== ""}
            <div class="mt-2 text-[--text-body] leading-6 text-text-primary">
              <span class="text-[--text-label] font-semibold uppercase tracking-[0.08em] text-text-muted">Promises.</span>
              {tile.promises}
            </div>
          {/if}
          {#if tile.denies.trim() !== ""}
            <div class="mt-1 text-[--text-body] leading-6 text-text-primary">
              <span class="text-[--text-label] font-semibold uppercase tracking-[0.08em] text-text-muted">Denies.</span>
              {tile.denies}
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</section>

<style>
  .root {
    break-inside: avoid;
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  .summary-header {
    flex-wrap: wrap;
  }

  .summary-header h2 {
    min-width: 0;
  }

  .summary-category {
    display: inline-flex;
    flex: 0 0 auto;
    width: fit-content;
    max-width: 100%;
    white-space: normal;
  }

  .summary-row {
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
  }

  .summary-row dt,
  .summary-row dd {
    min-width: 0;
  }

  @media (min-width: 641px) {
    .summary-row {
      grid-template-columns: minmax(max-content, 150px) minmax(0, 1fr);
      align-items: start;
    }
  }

  .bids-grid.md-multi {
    grid-template-columns: 1fr;
    min-width: 0;
  }

  @media (min-width: 768px) {
    .bids-grid.md-multi {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .bid-tile {
    break-inside: avoid;
    min-width: 0;
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--color-bg-card) 78%, white 6%), transparent),
      color-mix(in srgb, var(--color-bg-card) 92%, transparent);
  }

  .bid-tile__label {
    margin: 0 0 0.5rem;
    font-size: var(--text-label, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    overflow-wrap: break-word;
  }

  .bid-tile__bid :global(span) {
    font-size: clamp(2rem, 5vw, 3rem);
    line-height: 1;
  }

  .bid-tile__bid--hero :global(span) {
    font-size: clamp(2.75rem, 8vw, 4.75rem);
    line-height: 0.95;
  }
</style>
