<script lang="ts">
  import type { DebugLogEntry } from "../../../stores/bidding.svelte";
  import { fmtCall } from "./debug-helpers";

  interface Props {
    debugLog: readonly DebugLogEntry[];
  }

  let { debugLog }: Props = $props();
</script>

<details>
  <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">
    Bid Log
    {#if debugLog.length > 0}
      <span class="text-text-muted font-normal">({debugLog.length} entries)</span>
    {/if}
  </summary>
  <div class="pl-2 py-1">
    {#if debugLog.length === 0}
      <div class="text-text-muted italic">No bids yet</div>
    {:else}
      {#each debugLog as entry (entry.turnIndex)}
        <div class="mb-2 border-l-2 pl-2 {entry.feedback ? (entry.feedback.grade === 'correct' || entry.feedback.grade === 'correct-not-preferred' || entry.feedback.grade === 'acceptable' ? 'border-green-500/60' : entry.feedback.grade === 'near-miss' ? 'border-yellow-500/60' : 'border-red-500/60') : 'border-border-subtle'}">
          <div class="flex items-baseline gap-1.5">
            <span class="text-text-muted">#{entry.turnIndex}</span>
            <span class="text-text-primary font-semibold">{entry.seat}</span>
            {#if entry.call}
              <span class="font-bold {entry.feedback?.grade === 'correct' ? 'text-green-300' : entry.feedback?.grade === 'incorrect' ? 'text-red-400' : 'text-text-primary'}">{fmtCall(entry.call)}</span>
            {/if}
            {#if entry.feedback}
              <span class="text-xs px-1 rounded {entry.feedback.grade === 'correct' ? 'bg-green-900/50 text-green-300' : entry.feedback.grade === 'incorrect' ? 'bg-red-900/50 text-red-300' : entry.feedback.grade === 'near-miss' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-teal-900/50 text-teal-300'}">{entry.feedback.grade}</span>
            {/if}
          </div>
          {#if entry.snapshot.expectedBid}
            <div class="text-text-muted">
              expected: <span class="text-green-300">{fmtCall(entry.snapshot.expectedBid.call)}</span>
              {#if entry.snapshot.expectedBid.meaning}
                <span class="text-yellow-300 ml-1">{entry.snapshot.expectedBid.meaning}</span>
              {/if}
            </div>
          {/if}
          {#if entry.snapshot.machineSnapshot}
            <div class="text-text-muted">
              state: <span class="text-cyan-300">{entry.snapshot.machineSnapshot.currentStateId}</span>
              | forcing: <span class="text-text-primary">{entry.snapshot.machineSnapshot.registers.forcingState}</span>
            </div>
          {/if}
          {#if entry.feedback?.teachingResolution}
            {@const tr = entry.feedback.teachingResolution}
            {#if tr.acceptableBids.length > 0}
              <div class="text-text-muted">
                also ok: {tr.acceptableBids.map(ab => fmtCall(ab.call)).join(", ")}
              </div>
            {/if}
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</details>
