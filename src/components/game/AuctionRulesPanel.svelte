<script lang="ts">
  import type { BidHistoryEntry } from "../../stores/game.svelte";
  import { groupBidsByRound } from "../../lib/rules-display";
  import type { RoundEntry } from "../../lib/rules-display";
  import { formatCall, formatRuleName } from "../../lib/format";
  import { BID_SUIT_COLOR_CLASS } from "../../lib/tokens";
  import type { BidSuit } from "../../engine/types";

  interface Props {
    bidHistory: BidHistoryEntry[];
  }

  let { bidHistory }: Props = $props();

  const rounds = $derived(groupBidsByRound(bidHistory));

  function callColorClass(entry: RoundEntry): string {
    if (entry.call.type !== "bid") return "text-text-secondary";
    return BID_SUIT_COLOR_CLASS[entry.call.strain as BidSuit];
  }
</script>

<div class="flex flex-col gap-3 overflow-hidden">
  <div class="flex flex-col gap-1">
    <h2 class="text-base font-semibold text-text-primary">
      Auction Rules
    </h2>
    <p class="text-xs text-text-muted">
      Round-by-round view of convention rules applied during this auction
    </p>
  </div>

  {#if rounds.length === 0}
    <div class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle">
      <p class="text-text-muted text-sm">No auction data available.</p>
    </div>
  {:else}
    {#each rounds as round (round.roundNumber)}
      <div class="flex flex-col gap-1.5">
        <div
          class="text-xs font-medium text-text-muted uppercase tracking-wider border-b border-border-subtle pb-1"
          data-testid="round-header-{round.roundNumber}"
        >
          Round {round.roundNumber}
        </div>

        {#each round.entries as entry (entry.seat + '-' + round.roundNumber)}
          <div class="flex flex-col gap-0.5 pl-2">
            <div class="flex items-center gap-2 min-w-0">
              <!-- Seat label -->
              <span class="text-xs font-mono text-text-muted w-4 shrink-0">{entry.seat}:</span>

              <!-- Call -->
              <span class="font-mono font-bold text-sm {callColorClass(entry)}">
                {formatCall(entry.call)}
              </span>

              <!-- Rule name badge -->
              {#if entry.ruleName}
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-accent-primary-subtle text-accent-primary border border-accent-primary/30 truncate">
                  {formatRuleName(entry.ruleName)}
                </span>
              {/if}

              <!-- User correctness -->
              {#if entry.isUser && entry.isCorrect === true}
                <span class="text-green-400 text-xs" data-testid="bid-correct" aria-label="Correct bid">&#10003;</span>
              {:else if entry.isUser && entry.isCorrect === false}
                <span class="text-red-400 text-xs" data-testid="bid-incorrect" aria-label="Incorrect bid">&#10007;</span>
              {/if}
            </div>

            <!-- Conditions (if available) -->
            {#if entry.conditions && entry.conditions.length > 0}
              <div class="pl-6 flex flex-col gap-0.5">
                {#each entry.conditions as cond, ci (cond.name + '-' + ci)}
                  <p class="text-xs text-text-muted break-words flex items-center gap-1">
                    <span
                      class={cond.passed ? "text-accent-success" : "text-accent-danger"}
                      aria-hidden="true"
                    >{cond.passed ? "&#10003;" : "&#10007;"}</span>
                    <span>{cond.description}</span>
                  </p>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  {/if}
</div>
