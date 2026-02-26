<script lang="ts">
  import type { BidHistoryEntry } from "../../stores/game.svelte";
  import { groupBidsByRound } from "../../display/rules-display";
  import type { RoundEntry } from "../../display/rules-display";
  import { formatCall, formatRuleName } from "../../display/format";
  import { BID_SUIT_COLOR_CLASS } from "../../display/tokens";
  import type { BidSuit } from "../../engine/types";

  interface Props {
    bidHistory: BidHistoryEntry[];
  }

  const { bidHistory }: Props = $props();

  const rounds = $derived(groupBidsByRound(bidHistory));

  function callColorClass(entry: RoundEntry): string {
    if (entry.call.type !== "bid") return "text-text-secondary";
    return BID_SUIT_COLOR_CLASS[entry.call.strain as BidSuit];
  }
</script>

<div class="flex flex-col gap-3 overflow-hidden">
  <div class="flex flex-col gap-1">
    <h2 class="text-text-primary text-base font-semibold">Auction Rules</h2>
    <p class="text-text-muted text-xs">
      Round-by-round view of convention rules applied during this auction
    </p>
  </div>

  {#if rounds.length === 0}
    <div
      class="bg-bg-card border-border-subtle rounded-[--radius-md] border p-3"
    >
      <p class="text-text-muted text-sm">No auction data available.</p>
    </div>
  {:else}
    {#each rounds as round (round.roundNumber)}
      <div class="flex flex-col gap-1.5">
        <div
          class="text-text-muted border-border-subtle border-b pb-1 text-xs font-medium tracking-wider uppercase"
          data-testid="round-header-{round.roundNumber}"
        >
          Round {round.roundNumber}
        </div>

        {#each round.entries as entry (entry.seat + "-" + round.roundNumber)}
          <div class="flex flex-col gap-0.5 pl-2">
            <div class="flex min-w-0 items-center gap-2">
              <!-- Seat label -->
              <span class="text-text-muted w-4 shrink-0 font-mono text-xs"
                >{entry.seat}:</span
              >

              <!-- Call -->
              <span class="font-mono text-sm font-bold {callColorClass(entry)}">
                {formatCall(entry.call)}
              </span>

              <!-- Rule name badge -->
              {#if entry.ruleName}
                <span
                  class="bg-accent-primary-subtle text-accent-primary border-accent-primary/30 inline-flex items-center truncate rounded border px-1.5 py-0.5 text-xs font-medium"
                >
                  {formatRuleName(entry.ruleName)}
                </span>
              {/if}

              <!-- User correctness -->
              {#if entry.isUser && entry.isCorrect === true}
                <span
                  class="text-accent-success text-xs"
                  data-testid="bid-correct"
                  aria-label="Correct bid">&#10003;</span
                >
              {:else if entry.isUser && entry.isCorrect === false}
                <span
                  class="text-accent-danger text-xs"
                  data-testid="bid-incorrect"
                  aria-label="Incorrect bid">&#10007;</span
                >
              {/if}
            </div>

            <!-- Conditions (if available) -->
            {#if entry.conditions && entry.conditions.length > 0}
              <div class="flex flex-col gap-0.5 pl-6">
                {#each entry.conditions as cond, ci (cond.name + "-" + ci)}
                  <p
                    class="text-text-muted flex items-center gap-1 text-xs break-words"
                  >
                    <span
                      class={cond.passed
                        ? "text-accent-success"
                        : "text-accent-danger"}
                      aria-hidden="true"
                      >{cond.passed ? "&#10003;" : "&#10007;"}</span
                    >
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
