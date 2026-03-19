<script lang="ts">
  import type { DebugLogEntry } from "../../../stores/bidding.svelte";
  import { fmtCall } from "./debug-helpers";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    debugLog: readonly DebugLogEntry[];
  }

  let { debugLog }: Props = $props();
</script>

<DebugSection title="Bid Log" count={debugLog.length}>
  {#if debugLog.length === 0}
    <div class="text-text-muted italic text-[10px]">No bids yet</div>
  {:else}
    {#each debugLog as entry (entry.turnIndex)}
      <details class="mb-0.5">
        <summary class="cursor-pointer text-[10px] py-0.5 flex items-center gap-1 flex-wrap">
          <span class="text-text-muted">#{entry.turnIndex}</span>
          <span class="text-text-primary font-semibold">{entry.seat}</span>
          {#if entry.call}
            <span class="font-bold {entry.feedback?.grade === 'correct' ? 'text-green-300' : entry.feedback?.grade === 'incorrect' ? 'text-red-400' : 'text-text-primary'}">{fmtCall(entry.call)}</span>
          {/if}
          {#if entry.feedback}
            <span class="px-1 rounded text-[9px] {entry.feedback.grade === 'correct' ? 'bg-green-900/50 text-green-300' : entry.feedback.grade === 'incorrect' ? 'bg-red-900/50 text-red-300' : entry.feedback.grade === 'near-miss' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-teal-900/50 text-teal-300'}">{entry.feedback.grade}</span>
          {/if}
          {#if entry.snapshot.expectedBid}
            <span class="text-text-muted">exp: <span class="text-green-300">{fmtCall(entry.snapshot.expectedBid.call)}</span></span>
          {/if}
        </summary>
        <div class="pl-3 text-[10px] pb-0.5 border-l-2 ml-1 {entry.feedback ? (entry.feedback.grade === 'correct' || entry.feedback.grade === 'correct-not-preferred' || entry.feedback.grade === 'acceptable' ? 'border-green-500/40' : entry.feedback.grade === 'near-miss' ? 'border-yellow-500/40' : 'border-red-500/40') : 'border-border-subtle/30'}">
          {#if entry.snapshot.expectedBid?.meaning}
            <div class="text-text-muted">meaning: <span class="text-yellow-300">{entry.snapshot.expectedBid.meaning}</span></div>
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
              <div class="text-text-muted">also ok: {tr.acceptableBids.map(ab => fmtCall(ab.call)).join(", ")}</div>
            {/if}
          {/if}
        </div>
      </details>
    {/each}
  {/if}
</DebugSection>
