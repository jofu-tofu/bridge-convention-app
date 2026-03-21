<script lang="ts">
  import type { DebugBidFeedback } from "../../../stores/game.svelte";
  import { fmtCall } from "./debug-helpers";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    feedback: DebugBidFeedback | null;
  }

  let { feedback }: Props = $props();

  const gradeColors: Record<string, string> = {
    correct: "bg-green-900/50 text-green-300",
    "correct-not-preferred": "bg-green-900/40 text-green-200",
    acceptable: "bg-teal-900/50 text-teal-300",
    "near-miss": "bg-yellow-900/50 text-yellow-300",
    incorrect: "bg-red-900/50 text-red-300",
  };
</script>

<DebugSection
  title="Teaching"
  badge={feedback?.grade ?? null}
  badgeColor={feedback ? (gradeColors[feedback.grade] ?? "bg-gray-700 text-gray-300") : "bg-gray-700 text-gray-300"}
>
  {#if feedback}
    <div class="text-[10px] grid grid-cols-[auto_1fr] gap-x-2 gap-y-0 mb-1">
      <span class="text-text-muted">user bid</span>
      <span class="text-text-primary">{fmtCall(feedback.userCall)}</span>
      {#if feedback.expectedResult}
        <span class="text-text-muted">expected</span>
        <span class="text-green-300">{fmtCall(feedback.expectedResult.call)}</span>
      {/if}
    </div>

    {#if feedback.teachingResolution}
      {@const tr = feedback.teachingResolution}
      <div class="text-[10px]">
        <span class="text-text-muted">type:</span> <span class="text-text-primary">{tr.gradingType}</span>
        <span class="text-text-muted ml-2">ambiguity:</span> <span class="text-text-primary">{tr.ambiguityScore}</span>
      </div>
      {#if tr.acceptableBids.length > 0}
        <DebugSection title="Also acceptable" count={tr.acceptableBids.length} nested>
          {#each tr.acceptableBids as ab (ab.bidName)}
            <div class="text-[10px] leading-tight">
              <span class="text-teal-300">{fmtCall(ab.call)}</span>
              <span class="text-text-primary ml-0.5">{ab.meaning}</span>
              <span class="text-text-muted ml-0.5">({ab.tier}{ab.fullCredit ? ", full credit" : ""})</span>
            </div>
          {/each}
        </DebugSection>
      {/if}
      {#if tr.nearMissCalls && tr.nearMissCalls.length > 0}
        <DebugSection title="Near misses" count={tr.nearMissCalls.length} nested>
          {#each tr.nearMissCalls as nm (nm.call.type + (nm.call.type === 'bid' ? nm.call.level + nm.call.strain : ''))}
            <div class="text-[10px] leading-tight">
              <span class="text-yellow-400">{fmtCall(nm.call)}</span>
              <span class="text-text-muted ml-0.5">— {nm.reason}</span>
            </div>
          {/each}
        </DebugSection>
      {/if}
    {/if}
  {:else}
    <div class="text-text-muted italic text-[10px]">No feedback yet</div>
  {/if}
</DebugSection>
