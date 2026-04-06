<script lang="ts">
  import type { BidHistoryEntry, BidSuit, Call, HandEvaluationView } from "../../service";
  import { formatCall, Seat } from "../../service";
  import { BID_SUIT_COLOR_CLASS } from "../shared/tokens";
  import { gradeBadgeConfig, groupBidsByRound } from "./RoundBidList";

  interface Props {
    bidHistory: readonly BidHistoryEntry[];
    /** If true, shows expected result for incorrect user bids. */
    showExpectedResult?: boolean;
    /** Optional prefix for data-testid attributes. If omitted, no test IDs are added. */
    testIdPrefix?: string;
    /** Global bid index (0-based) — entries beyond this are dimmed. null = all visible. */
    visibleUpTo?: number | null;
    /** Global bid index (0-based) to highlight with accent ring. null = none. */
    highlightIndex?: number | null;
    /** Click callback with global bid index. Makes bid entries clickable. */
    onBidClick?: (globalIndex: number) => void;
    /** User hand evaluation for condition text enrichment in review detail. */
    handEvaluation?: HandEvaluationView;
  }

  let {
    bidHistory,
    showExpectedResult = false,
    testIdPrefix,
    visibleUpTo = null,
    highlightIndex = null,
    onBidClick,
    handEvaluation: _handEvaluation,
  }: Props = $props();

  const rounds = $derived(groupBidsByRound(bidHistory));

  function globalIndex(roundNumber: number, entryIdx: number): number {
    return (roundNumber - 1) * 4 + entryIdx;
  }

  function isDimmed(roundNumber: number, entryIdx: number): boolean {
    if (visibleUpTo === null) return false;
    return globalIndex(roundNumber, entryIdx) >= visibleUpTo;
  }

  function isHighlighted(roundNumber: number, entryIdx: number): boolean {
    if (highlightIndex === null) return false;
    return globalIndex(roundNumber, entryIdx) === highlightIndex;
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
  <p class="text-text-muted text-[--text-detail]">No bids yet.</p>
{:else}
  {#each rounds as round (round.roundNumber)}
    <div class="flex flex-col gap-1.5">
      <div
        class="text-text-muted border-border-subtle border-b pb-1 text-[--text-label] font-medium tracking-wider uppercase"
        data-testid={testIdPrefix ? `${testIdPrefix}-round-header-${round.roundNumber}` : undefined}
      >
        Round {round.roundNumber}
      </div>

      {#each round.entries as entry, entryIdx (entry.seat + "-" + round.roundNumber)}
        {@const dimmed = isDimmed(round.roundNumber, entryIdx)}
        {@const highlighted = isHighlighted(round.roundNumber, entryIdx)}
        {@const badge = gradeBadgeConfig(entry.grade)}
        {@const rowClass = `flex flex-col gap-0.5 pl-2 rounded-[--radius-sm] transition-opacity ${
          dimmed ? "opacity-30 " : ""
        }${highlighted ? "bg-accent-primary-subtle ring-1 ring-accent-primary/40 " : ""}${
          onBidClick ? "cursor-pointer hover:bg-bg-elevated " : ""
        }`.trim()}
        {#if onBidClick}
          <button
            type="button"
            class={rowClass}
            onclick={() => onBidClick(globalIndex(round.roundNumber, entryIdx))}
          >
            <!-- Bid line -->
            <div class="flex min-w-0 items-center gap-2">
              <span class="text-text-muted w-4 shrink-0 font-mono text-[--text-label]">{entry.seat}:</span>
              <span class="font-mono text-[--text-detail] font-bold {callColorClass(entry.call)}">
                {formatCall(entry.call)}
              </span>
              {#if badge}
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 font-semibold tracking-wide text-[--text-annotation] uppercase {badge.colorClass}"
                >
                  {badge.label}
                </span>
              {:else if entry.isCorrect === true}
                <span
                  class="text-accent-success text-[--text-label]"
                  data-testid={testIdPrefix ? "bid-correct" : undefined}
                  aria-label="Correct bid">&#10003;</span>
              {:else if entry.isCorrect === false}
                <span
                  class="text-accent-danger text-[--text-label]"
                  data-testid={testIdPrefix ? "bid-incorrect" : undefined}
                  aria-label="Incorrect bid">&#10007;</span>
              {/if}
            </div>

            <!-- Wrong bid: show expected -->
            {#if showExpectedResult && entry.isUser && entry.isCorrect === false && entry.expectedResult}
              <div class="pl-6 text-[--text-label] flex items-center gap-1.5">
                <span class="text-fb-incorrect-text/70">Expected:</span>
                <span class="font-mono font-bold text-fb-incorrect-bright">{formatCall(entry.expectedResult.call)}</span>
                {#if entry.expectedResult.meaning}
                  <span class="text-fb-incorrect-dim/60">— {entry.expectedResult.meaning}</span>
                {/if}
              </div>
            {/if}

            <!-- N/S meaning -->
            {#if isNS(entry.seat) && entry.meaning}
              <div class="pl-6 text-[--text-label] text-text-secondary">
                {entry.meaning}
              </div>
            {/if}
          </button>
        {:else}
          <div class={rowClass}>
            <!-- Bid line -->
            <div class="flex min-w-0 items-center gap-2">
              <span class="text-text-muted w-4 shrink-0 font-mono text-[--text-label]">{entry.seat}:</span>
              <span class="font-mono text-[--text-detail] font-bold {callColorClass(entry.call)}">
                {formatCall(entry.call)}
              </span>
              {#if badge}
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 font-semibold tracking-wide text-[--text-annotation] uppercase {badge.colorClass}"
                >
                  {badge.label}
                </span>
              {:else if entry.isCorrect === true}
                <span
                  class="text-accent-success text-[--text-label]"
                  data-testid={testIdPrefix ? "bid-correct" : undefined}
                  aria-label="Correct bid">&#10003;</span>
              {:else if entry.isCorrect === false}
                <span
                  class="text-accent-danger text-[--text-label]"
                  data-testid={testIdPrefix ? "bid-incorrect" : undefined}
                  aria-label="Incorrect bid">&#10007;</span>
              {/if}
            </div>

            <!-- Wrong bid: show expected -->
            {#if showExpectedResult && entry.isUser && entry.isCorrect === false && entry.expectedResult}
              <div class="pl-6 text-[--text-label] flex items-center gap-1.5">
                <span class="text-fb-incorrect-text/70">Expected:</span>
                <span class="font-mono font-bold text-fb-incorrect-bright">{formatCall(entry.expectedResult.call)}</span>
                {#if entry.expectedResult.meaning}
                  <span class="text-fb-incorrect-dim/60">— {entry.expectedResult.meaning}</span>
                {/if}
              </div>
            {/if}

            <!-- N/S meaning -->
            {#if isNS(entry.seat) && entry.meaning}
              <div class="pl-6 text-[--text-label] text-text-secondary">
                {entry.meaning}
              </div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/each}
{/if}
