<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import type { BidHistoryEntry } from "../../shared/types";
  import { groupBidsByRound } from "../../display/rules-display";
  import { formatCall } from "../../display/format";
  import { BID_SUIT_COLOR_CLASS } from "../../display/tokens";
  import type { BidSuit, Call } from "../../engine/types";
  import { Seat } from "../../engine/types";

  interface Props {
    bidHistory: BidHistoryEntry[];
    /** If true, siblings start expanded; if false, they start collapsed. */
    defaultSiblingsExpanded?: boolean;
    /** If true, shows expected result for incorrect user bids. */
    showExpectedResult?: boolean;
    /** Optional prefix for data-testid attributes. If omitted, no test IDs are added. */
    testIdPrefix?: string;
  }

  let {
    bidHistory,
    defaultSiblingsExpanded = false,
    showExpectedResult = false,
    testIdPrefix,
  }: Props = $props();

  const rounds = $derived(groupBidsByRound(bidHistory));

  /**
   * Track toggled siblings. When defaultSiblingsExpanded=true, this set holds collapsed entries.
   * When defaultSiblingsExpanded=false, this set holds expanded entries.
   */
  let toggledSiblings = new SvelteSet<string>();

  function toggleSiblings(key: string) {
    if (toggledSiblings.has(key)) {
      toggledSiblings.delete(key);
    } else {
      toggledSiblings.add(key);
    }
  }

  function isSiblingVisible(key: string): boolean {
    const toggled = toggledSiblings.has(key);
    return defaultSiblingsExpanded ? !toggled : toggled;
  }

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
        {@const entryKey = entry.seat + "-" + round.roundNumber}
        {@const siblings = entry.treePath?.siblings ?? []}
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

          <!-- Expandable alternatives -->
          {#if isNS(entry.seat) && siblings.length > 0}
            <div class="pl-6">
              <button
                type="button"
                class="text-text-muted hover:text-text-secondary flex items-center gap-1 text-xs transition-colors cursor-pointer"
                onclick={() => toggleSiblings(entryKey)}
                aria-expanded={isSiblingVisible(entryKey)}
              >
                <span class="shrink-0">{isSiblingVisible(entryKey) ? "▾" : "▸"}</span>
                <span>{siblings.length} alternative{siblings.length !== 1 ? "s" : ""}</span>
              </button>
              {#if isSiblingVisible(entryKey)}
                <div class="mt-0.5 space-y-0.5 pl-3">
                  {#each siblings as sibling, si (sibling.bidName + "-" + si)}
                    <div class="text-xs flex flex-col gap-0.5">
                      <div class="flex items-baseline gap-1.5">
                        <span class="text-accent-danger" aria-hidden="true">✗</span>
                        <span class="font-mono font-bold {callColorClass(sibling.call)}">{formatCall(sibling.call)}</span>
                        <span class="text-text-muted">— {sibling.meaning}</span>
                      </div>
                      {#if sibling.failedConditions.length > 0}
                        <ul class="text-text-muted/50 ml-4 mt-0.5 space-y-0.5" role="list" aria-label="Failed conditions for {sibling.bidName}">
                          {#each sibling.failedConditions as fc, fi (fc.name + "-" + fi)}
                            <li class="flex items-center gap-1.5">
                              <span class="text-accent-danger" aria-hidden="true">✗</span>
                              <span>{fc.description}</span>
                            </li>
                          {/each}
                        </ul>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
{/if}
