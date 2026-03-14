<script lang="ts">
  import type { BidHistoryEntry } from "../../core/contracts";
  import { groupBidsByRound } from "./RoundBidList";
  import { formatCall } from "../../core/display/format";
  import { BID_SUIT_COLOR_CLASS } from "../../core/display/tokens";
  import type { BidSuit, Call } from "../../engine/types";
  import { Seat } from "../../engine/types";

  interface Props {
    bidHistory: BidHistoryEntry[];
    /** If true, shows expected result for incorrect user bids. */
    showExpectedResult?: boolean;
    /** Optional prefix for data-testid attributes. If omitted, no test IDs are added. */
    testIdPrefix?: string;
  }

  let {
    bidHistory,
    showExpectedResult = false,
    testIdPrefix,
  }: Props = $props();

  const rounds = $derived(groupBidsByRound(bidHistory));

  function callColorClass(call: Call): string {
    if (call.type !== "bid") return "text-text-secondary";
    return BID_SUIT_COLOR_CLASS[call.strain as BidSuit];
  }

  function isNS(seat: Seat): boolean {
    return seat === Seat.North || seat === Seat.South;
  }
</script>

{#if rounds.length === 0}
  <p class="text-text-muted text-sm">No bids yet.</p>
{:else}
  {#each rounds as round (round.roundNumber)}
    <div class="flex flex-col gap-1.5">
      <div
        class="text-text-muted border-border-subtle border-b pb-1 text-xs font-medium tracking-wider uppercase"
        data-testid={testIdPrefix ? `${testIdPrefix}-round-header-${round.roundNumber}` : undefined}
      >
        Round {round.roundNumber}
      </div>

      {#each round.entries as entry (entry.seat + "-" + round.roundNumber)}
        <div class="flex flex-col gap-0.5 pl-2">
          <!-- Bid line -->
          <div class="flex min-w-0 items-center gap-2">
            <span class="text-text-muted w-4 shrink-0 font-mono text-xs">{entry.seat}:</span>
            <span class="font-mono text-sm font-bold {callColorClass(entry.call)}">
              {formatCall(entry.call)}
            </span>
            {#if entry.isCorrect === true}
              <span
                class="text-accent-success text-xs"
                data-testid={testIdPrefix ? "bid-correct" : undefined}
                aria-label="Correct bid">&#10003;</span>
            {:else if entry.isCorrect === false}
              <span
                class="text-accent-danger text-xs"
                data-testid={testIdPrefix ? "bid-incorrect" : undefined}
                aria-label="Incorrect bid">&#10007;</span>
            {/if}
          </div>

          <!-- Wrong bid: show expected -->
          {#if showExpectedResult && entry.isUser && entry.isCorrect === false && entry.expectedResult}
            <div class="pl-6 text-xs flex items-center gap-1.5">
              <span class="text-red-300/70">Expected:</span>
              <span class="font-mono font-bold text-red-100">{formatCall(entry.expectedResult.call)}</span>
              {#if entry.expectedResult.meaning}
                <span class="text-red-200/60">— {entry.expectedResult.meaning}</span>
              {/if}
            </div>
          {/if}

          <!-- N/S meaning -->
          {#if isNS(entry.seat) && entry.meaning}
            <div class="pl-6 text-xs text-text-secondary">
              {entry.meaning}
            </div>
          {/if}

        </div>
      {/each}
    </div>
  {/each}
{/if}
