<script lang="ts">
  import type { BidHistoryEntry } from "../../stores/game.svelte";
  import { formatCall } from "../../lib/format";
  import ConventionCallout from "../shared/ConventionCallout.svelte";

  interface Props {
    bidHistory: BidHistoryEntry[];
  }

  let { bidHistory }: Props = $props();
</script>

<div class="space-y-2">
  <h3 class="text-lg font-semibold text-text-secondary">Bidding Review</h3>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="text-text-muted">
          <th class="text-left px-2 py-1">Seat</th>
          <th class="text-left px-2 py-1">Call</th>
          <th class="text-left px-2 py-1">Details</th>
        </tr>
      </thead>
      <tbody>
        {#each bidHistory as entry, idx (idx)}
          <tr class="border-t border-border-subtle {entry.isUser ? 'bg-accent-primary-subtle' : ''}">
            <td class="px-2 py-2 font-mono text-text-secondary">{entry.seat}</td>
            <td class="px-2 py-2 font-mono text-text-primary">{formatCall(entry.call)}</td>
            <td class="px-2 py-2">
              {#if entry.ruleName}
                <ConventionCallout ruleName={entry.ruleName} explanation={entry.explanation} />
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
