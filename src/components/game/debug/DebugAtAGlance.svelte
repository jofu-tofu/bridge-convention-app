<!-- At-a-glance summary card — always visible at the top of the debug drawer.
     Shows the most important info (state, recommended bid, grade) without
     requiring any expansion. Designed for quick "what happened?" scanning. -->
<script lang="ts">
  import type { DebugSnapshotBase } from "../../../service/debug-types";
  import type { DebugBidFeedback } from "../../../stores/game.svelte";
  import { fmtCall, GRADE_COLORS, GRADE_COLOR_FALLBACK } from "./debug-helpers";

  interface Props {
    snapshot: DebugSnapshotBase | null;
    feedback: DebugBidFeedback | null;
    phase: string;
  }

  let { snapshot, feedback, phase }: Props = $props();
</script>

<div class="rounded border border-border-subtle/40 bg-bg-card/60 px-2.5 py-2 text-xs space-y-1.5">
  <!-- Row 1: Phase + Machine State -->
  <div class="flex items-center gap-2 flex-wrap">
    <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-blue-900/50 text-blue-300">{phase}</span>
    {#if snapshot?.machineSnapshot}
      <span class="text-text-muted">state:</span>
      <span class="text-cyan-300 font-mono font-bold">{snapshot.machineSnapshot.currentStateId}</span>
      {#if snapshot.machineSnapshot.registers?.forcingState && snapshot.machineSnapshot.registers.forcingState !== "nonforcing"}
        <span class="text-[10px] px-1 rounded {snapshot.machineSnapshot.registers.forcingState === 'game-forcing' ? 'bg-red-900/40 text-red-300' : 'bg-yellow-900/40 text-yellow-300'}">{snapshot.machineSnapshot.registers.forcingState}</span>
      {/if}
    {/if}
  </div>

  <!-- Row 2: Recommended Bid -->
  {#if snapshot?.expectedBid}
    {@const bid = snapshot.expectedBid}
    <div class="flex items-baseline gap-2">
      <span class="text-text-muted">expected:</span>
      <span class="text-sm font-bold text-green-300">{fmtCall(bid.call)}</span>
      <span class="text-text-muted truncate">{bid.meaning ?? bid.ruleName ?? ""}</span>
    </div>
  {:else if snapshot}
    <div class="flex items-baseline gap-2">
      <span class="text-text-muted">expected:</span>
      <span class="text-sm font-bold text-yellow-300/70">Pass</span>
      <span class="text-text-muted">(no match)</span>
    </div>
  {/if}

  <!-- Row 3: Pipeline stats -->
  {#if snapshot?.pipelineResult}
    {@const pr = snapshot.pipelineResult}
    <div class="flex items-center gap-3 text-[10px] text-text-muted">
      <span><span class="text-green-400 font-semibold">{pr.truthSet.length}</span> matched</span>
      <span><span class="text-text-secondary font-semibold">{pr.acceptableSet.length}</span> other</span>
      <span><span class="text-red-400/70 font-semibold">{pr.eliminated.length}</span> eliminated</span>
      {#if snapshot.posteriorSummary}
        <span><span class="text-text-secondary font-semibold">{snapshot.posteriorSummary.sampleCount}</span> samples</span>
      {/if}
    </div>
  {/if}

  <!-- Row 4: Feedback (if available) -->
  {#if feedback}
    <div class="flex items-center gap-2 pt-0.5 border-t border-border-subtle/30">
      <span class="px-1.5 py-0.5 rounded text-[10px] font-bold border {GRADE_COLORS[feedback.grade] ?? GRADE_COLOR_FALLBACK}">{feedback.grade}</span>
      <span class="text-text-muted">bid:</span>
      <span class="font-bold text-text-primary">{fmtCall(feedback.userCall)}</span>
      {#if feedback.expectedResult}
        <span class="text-text-muted">expected:</span>
        <span class="font-bold text-green-300">{fmtCall(feedback.expectedResult.call)}</span>
      {/if}
    </div>
  {/if}
</div>
