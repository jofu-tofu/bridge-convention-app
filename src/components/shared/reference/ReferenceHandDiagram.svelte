<script lang="ts">
  import type { ReferenceHandSample } from "./types";

  interface Props {
    hand: ReferenceHandSample;
    label: string;
  }

  let { hand, label }: Props = $props();

  type SuitKey = "spades" | "hearts" | "diamonds" | "clubs";

  interface SuitRow {
    key: SuitKey;
    glyph: string;
    colorClass: string;
    ranks: string[];
  }

  function splitRanks(holding: string): string[] {
    if (!holding) return [];
    // Ranks are single characters except "10" which we render as "T".
    return holding
      .replace(/10/g, "T")
      .split("")
      .filter((c) => c.trim().length > 0);
  }

  const rows = $derived<SuitRow[]>([
    {
      key: "spades",
      glyph: "♠",
      colorClass: "text-suit-card-spades",
      ranks: splitRanks(hand.spades),
    },
    {
      key: "hearts",
      glyph: "♥",
      colorClass: "text-suit-card-hearts",
      ranks: splitRanks(hand.hearts),
    },
    {
      key: "diamonds",
      glyph: "♦",
      colorClass: "text-suit-card-diamonds",
      ranks: splitRanks(hand.diamonds),
    },
    {
      key: "clubs",
      glyph: "♣",
      colorClass: "text-suit-card-clubs",
      ranks: splitRanks(hand.clubs),
    },
  ]);
</script>

<section
  class="rounded-[--radius-md] border border-border-subtle bg-bg-base/70 px-4 py-3"
  aria-label={label}
>
  <p class="mb-2 text-[--text-label] font-semibold uppercase tracking-[0.12em] text-text-muted">
    Responder hand
  </p>

  <div class="space-y-1.5">
    {#each rows as row (row.key)}
      <div class="flex items-center gap-2">
        <span
          class={`w-5 text-center font-mono text-[--text-body] ${row.colorClass}`}
          aria-hidden="true">{row.glyph}</span
        >
        {#if row.ranks.length === 0}
          <span class="text-text-muted italic text-[--text-annotation]">void</span>
        {:else}
          <div class="flex flex-wrap gap-1">
            {#each row.ranks as rank, i (`${row.key}-${i}-${rank}`)}
              <span
                class={`relative inline-flex items-center justify-center rounded-[--radius-sm] bg-card-face shadow-sm ring-1 ring-black/10 ${row.colorClass}`}
                style="width: 1.5rem; height: 2rem;"
                aria-label={`${rank === "T" ? "10" : rank} of ${row.key}`}
              >
                <span
                  class="absolute top-0.5 left-1 font-bold leading-none"
                  style="font-size: 0.7rem;"
                >
                  {rank}
                </span>
                <span
                  class="absolute bottom-0.5 right-1 leading-none"
                  style="font-size: 0.55rem;"
                  aria-hidden="true"
                >
                  {row.glyph}
                </span>
              </span>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</section>
