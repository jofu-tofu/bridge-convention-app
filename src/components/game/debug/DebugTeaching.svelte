<script lang="ts">
  import type { BidFeedback } from "../../../stores/bidding.svelte";
  import { fmtCall } from "./debug-helpers";

  interface Props {
    feedback: BidFeedback | null;
  }

  let { feedback }: Props = $props();
</script>

<details>
  <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">
    Teaching
    {#if feedback}<span class="text-text-muted font-normal">(grade: {feedback.grade})</span>{/if}
  </summary>
  <div class="pl-2 py-1">
    {#if feedback}
      <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 mb-2">
        <span class="text-text-muted">grade</span>
        <span class="font-bold {feedback.grade === 'correct' ? 'text-green-400' : feedback.grade === 'correct-not-preferred' ? 'text-green-300' : feedback.grade === 'acceptable' ? 'text-teal-300' : feedback.grade === 'near-miss' ? 'text-yellow-400' : 'text-red-400'}">{feedback.grade}</span>
        <span class="text-text-muted">user bid</span>
        <span class="text-text-primary">{fmtCall(feedback.userCall)}</span>
        {#if feedback.expectedResult}
          <span class="text-text-muted">expected</span>
          <span class="text-green-300">{fmtCall(feedback.expectedResult.call)}</span>
        {/if}
      </div>

      {#if feedback.teachingResolution}
        {@const tr = feedback.teachingResolution}
        <div class="mb-1.5">
          <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            <span class="text-text-muted">type</span>
            <span class="text-text-primary">{tr.gradingType}</span>
            <span class="text-text-muted">ambiguity</span>
            <span class="text-text-primary">{tr.ambiguityScore}</span>
          </div>
          {#if tr.acceptableBids.length > 0}
            <div class="mt-1">
              <span class="text-text-muted">also acceptable:</span>
              {#each tr.acceptableBids as ab (ab.bidName)}
                <div class="pl-2">
                  <span class="text-teal-300">{fmtCall(ab.call)}</span>
                  <span class="text-text-primary ml-1">{ab.meaning}</span>
                  <span class="text-text-muted ml-1">({ab.tier}{ab.fullCredit ? ", full credit" : ""})</span>
                </div>
              {/each}
            </div>
          {/if}
          {#if tr.nearMissCalls && tr.nearMissCalls.length > 0}
            <div class="mt-1">
              <span class="text-text-muted">near-misses:</span>
              {#each tr.nearMissCalls as nm (nm.call.type + (nm.call.type === 'bid' ? nm.call.level + nm.call.strain : ''))}
                <div class="pl-2">
                  <span class="text-yellow-400">{fmtCall(nm.call)}</span>
                  <span class="text-text-muted ml-1">— {nm.reason}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {:else}
      <div class="text-text-muted italic">No feedback yet (bid to see grading)</div>
    {/if}
  </div>
</details>
