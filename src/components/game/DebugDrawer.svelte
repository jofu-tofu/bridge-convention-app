<!-- Full-lifecycle debug drawer. See also: DebugPanel.svelte (bidding-phase-only suggested bid display in BiddingSidePanel). -->
<script lang="ts">
  import { Seat, Suit } from "../../engine/types";
  import type { Hand, Card } from "../../engine/types";
  import { getGameStore, getAppStore } from "../../stores/context";
  import { computeHcp } from "../../display/hcp";
  import { formatCall, SUIT_SYMBOLS } from "../../display/format";
  import { sortCards } from "../../display/sort-cards";
  import { computeBidEvalTraces } from "../../display/debug-bid-eval";

  interface Props {
    open: boolean;
  }

  let { open }: Props = $props();

  const gameStore = getGameStore();
  const appStore = getAppStore();

  const ALL_SEATS = [Seat.North, Seat.East, Seat.South, Seat.West] as const;

  // Compute full rule evaluation trace for each bid in history (recomputes when bidHistory or auction entries change)
  const bidEvalTraces = $derived.by(() => {
    return computeBidEvalTraces(
      appStore.selectedConvention,
      gameStore.deal,
      gameStore.bidHistory,
      gameStore.auction.entries,
    );
  });

  function formatSuitCards(cards: readonly Card[], suit: Suit): string {
    const sorted = sortCards([...cards]);
    return sorted
      .filter((c) => c.suit === suit)
      .map((c) => c.rank)
      .join("");
  }
</script>

<aside
  class="fixed top-0 right-0 h-full w-[380px] bg-bg-elevated border-l border-border-subtle shadow-2xl z-40 overflow-y-auto font-mono text-xs text-text-secondary transition-transform duration-200 ease-in-out {open
    ? 'translate-x-0'
    : 'translate-x-full'}"
  aria-label="Debug drawer"
  inert={!open}
>
  <!-- Header -->
  <div
    class="sticky top-0 bg-bg-elevated border-b border-border-subtle px-3 py-2 flex items-center justify-between z-10"
  >
    <span class="text-text-primary font-semibold text-sm">Debug</span>
    <button
      class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer"
      onclick={() => appStore.toggleDebugPanel()}
      aria-label="Close debug panel"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  </div>

  <!-- Engine status bar -->
  {#if appStore.engineStatus}
    <div
      class="px-3 py-1.5 text-xs font-mono border-b border-border-subtle {appStore.engineStatus.includes('UNREACHABLE') ? 'bg-red-900/80 text-red-200' : 'bg-green-900/80 text-green-200'}"
    >
      {appStore.engineStatus}
    </div>
  {/if}

  <div class="p-3 flex flex-col gap-1">
    <!-- 1. Deal Info -->
    <details open>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1"
        >Deal Info</summary
      >
      <div class="pl-2 py-1 flex flex-col gap-0.5">
        <div>
          Convention: <span class="text-text-primary"
            >{appStore.selectedConvention?.name ?? "None"}</span
          >
          <span class="text-text-muted">
            ({appStore.selectedConvention?.id ?? "—"})</span
          >
        </div>
        {#if appStore.devSeed != null}
          <div>Seed: <span class="text-text-primary">{appStore.devSeed}</span></div>
        {/if}
        <div>
          Dealer: <span class="text-text-primary"
            >{gameStore.deal?.dealer ?? "—"}</span
          >
        </div>
        <div>
          Vulnerability: <span class="text-text-primary"
            >{gameStore.deal?.vulnerability ?? "—"}</span
          >
        </div>
        <div>
          Phase: <span class="text-text-primary">{gameStore.phase}</span>
        </div>
      </div>
    </details>

    <!-- 2. All Hands -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1"
        >All Hands</summary
      >
      <div class="pl-2 py-1">
        {#if gameStore.deal}
          {#each ALL_SEATS as seat (seat)}
            <div class="mb-2">
              <div class="font-semibold text-text-primary">
                {seat}
                <span class="text-text-muted font-normal"
                  >({computeHcp(gameStore.deal.hands[seat])} HCP)</span
                >
              </div>
              <div class="pl-2">
                {#each [{ suit: Suit.Spades, sym: "♠" }, { suit: Suit.Hearts, sym: "♥" }, { suit: Suit.Diamonds, sym: "♦" }, { suit: Suit.Clubs, sym: "♣" }] as { suit, sym } (suit)}
                  <div>
                    <span
                      class={suit === Suit.Hearts || suit === Suit.Diamonds
                        ? "text-red-400"
                        : "text-text-primary"}>{sym}</span
                    >
                    {formatSuitCards(gameStore.deal.hands[seat].cards, suit)}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </details>

    <!-- 3. Bid Evaluation Trace -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1"
        >Bid Evaluation Trace</summary
      >
      <div class="pl-2 py-1">
        {#if bidEvalTraces.length === 0}
          <div class="text-text-muted italic">No bids yet</div>
        {:else}
          {#each bidEvalTraces as { entry, allResults }, i (entry.seat + '-' + i)}
            <details class="mb-1">
              <summary class="cursor-pointer">
                <span class="text-text-primary">{entry.seat}</span>:
                <span class="font-bold text-text-primary"
                  >{formatCall(entry.call)}</span
                >
                {#if entry.ruleName}
                  <span class="text-text-muted">({entry.ruleName})</span>
                {/if}
              </summary>
              <div class="pl-4 py-0.5">
                {#each allResults as result, ri (result.ruleName + '-' + ri)}
                  <div
                    class={result.matched
                      ? result.isLegal
                        ? "text-green-400"
                        : "text-yellow-400"
                      : "text-text-muted"}
                  >
                    {result.matched ? (result.isLegal ? "✓" : "⚠") : "✗"}
                    {result.ruleName}
                    {#if result.call}→ {formatCall(result.call)}{/if}
                    {#if result.matched && !result.isLegal}
                      <span class="text-yellow-500">(illegal)</span>{/if}
                  </div>
                  {#if result.conditionResults}
                    <div class="pl-4 text-text-muted">
                      {#each result.conditionResults as cr, ci (cr.condition.name + '-' + ci)}
                        <div>
                          {cr.passed ? "✓" : "✗"}
                          {cr.condition.name}: {cr.description}
                        </div>
                      {/each}
                    </div>
                  {/if}
                {/each}
              </div>
            </details>
          {/each}
        {/if}
      </div>
    </details>

    <!-- 4. Inference Timeline -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1"
        >Inference Timeline</summary
      >
      <div class="pl-2 py-1">
        {#if gameStore.inferenceTimeline.length === 0}
          <div class="text-text-muted italic">No inferences</div>
        {:else}
          {#each gameStore.inferenceTimeline as snapshot, i (snapshot.entry.seat + '-' + i)}
            <div class="mb-1 border-l border-border-subtle pl-2">
              <div>
                <span class="text-text-primary">{snapshot.entry.seat}</span>:
                <span class="font-bold">{formatCall(snapshot.entry.call)}</span>
              </div>
              {#if snapshot.newInference}
                <div class="text-green-400">
                  HCP: {snapshot.newInference.minHcp ?? "?"}-{snapshot.newInference
                    .maxHcp ?? "?"}
                  <span class="text-text-muted"
                    >({snapshot.newInference.source})</span
                  >
                </div>
              {:else}
                <div class="text-text-muted">No inference</div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </details>

    <!-- 5. Play Log -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1"
        >Play Log</summary
      >
      <div class="pl-2 py-1">
        {#if gameStore.playLog.length === 0}
          <div class="text-text-muted italic">No plays yet</div>
        {:else}
          {#each gameStore.playLog as entry, i (entry.seat + '-' + entry.card.suit + entry.card.rank)}
            {#if i === 0 || entry.trickIndex !== gameStore.playLog[i - 1]?.trickIndex}
              <div class="text-text-primary font-semibold mt-1">
                Trick {entry.trickIndex + 1}
              </div>
            {/if}
            <div class="pl-2">
              <span class="text-text-primary">{entry.seat}</span>:
              {SUIT_SYMBOLS[entry.card.suit]}{entry.card.rank}
              <span class="text-text-muted">({entry.reason})</span>
            </div>
          {/each}
        {/if}
      </div>
    </details>

    <!-- 6. Live Inferences -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1"
        >Live Inferences</summary
      >
      <div class="pl-2 py-1">
        {#if gameStore.playInferences}
          {#each ALL_SEATS as seat (seat)}
            {@const inf = gameStore.playInferences[seat]}
            <div class="mb-1">
              <div class="font-semibold text-text-primary">{seat}</div>
              <div class="pl-2">
                HCP: {inf.hcpRange.min}-{inf.hcpRange.max}
                {#if inf.isBalanced !== undefined}
                  | Bal: {inf.isBalanced ? "Y" : "N"}
                {/if}
              </div>
            </div>
          {/each}
        {:else}
          <div class="text-text-muted italic">No inferences available</div>
        {/if}
      </div>
    </details>
  </div>
</aside>
