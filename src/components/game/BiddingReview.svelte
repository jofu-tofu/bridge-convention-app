<script lang="ts">
  import type { BidHistoryEntry } from "../../stores/game.svelte";
  import { formatCall } from "../../display/format";
  import ConventionCallout from "../shared/ConventionCallout.svelte";

  interface Props {
    bidHistory: BidHistoryEntry[];
  }

  let { bidHistory }: Props = $props();
</script>

<div class="flex flex-col gap-2">
  <h3 class="text-lg font-semibold text-text-secondary">Bidding Review</h3>
  <div class="min-w-0">
    <table class="w-full text-sm">
      <caption class="sr-only">Bidding review</caption>
      <thead>
        <tr class="text-text-muted">
          <th class="text-left px-2 py-1">Seat</th>
          <th class="text-left px-2 py-1">Call</th>
          <th class="text-left px-2 py-1">Details</th>
        </tr>
      </thead>
      <tbody>
        {#each bidHistory as entry, idx (entry.seat + "-" + idx)}
          <tr
            class="border-t border-border-subtle {entry.isUser && entry.isCorrect === false
              ? 'bg-red-950/40'
              : entry.isUser
                ? 'bg-accent-primary-subtle'
                : ''}"
          >
            <td class="px-2 py-2 font-mono text-text-secondary">{entry.seat}</td
            >
            <td class="px-2 py-2 font-mono {entry.isUser && entry.isCorrect === false ? 'text-red-300' : 'text-text-primary'}"
              >{formatCall(entry.call)}{#if entry.isUser && entry.isCorrect === false} <span class="text-red-400 text-xs">✗</span>{/if}</td
            >
            <td class="px-2 py-2 break-words">
              {#if entry.isUser && entry.isCorrect === false && entry.expectedResult}
                <div class="space-y-1">
                  <div class="flex items-center gap-1.5 text-xs">
                    <span class="text-red-300/70">Expected:</span>
                    <span class="font-mono font-bold text-red-100">{formatCall(entry.expectedResult.call)}</span>
                  </div>
                  {#if entry.expectedResult.ruleName}
                    <ConventionCallout
                      ruleName={entry.expectedResult.ruleName}
                      explanation={entry.expectedResult.explanation}
                      conditions={entry.expectedResult.conditions}
                    />
                  {:else if entry.expectedResult.explanation}
                    <span class="text-red-200/60 text-xs">{entry.expectedResult.explanation}</span>
                  {/if}
                </div>
              {:else if entry.ruleName}
                <ConventionCallout
                  ruleName={entry.ruleName}
                  explanation={entry.explanation}
                  conditions={entry.conditions}
                />
              {:else}
                <span class="text-text-muted text-sm">{entry.explanation}</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
