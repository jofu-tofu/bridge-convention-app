<script lang="ts">
  import type { DebugBidFeedback } from "../../../stores/game.svelte";
  import { fmtCall, GRADE_COLORS, GRADE_COLOR_FALLBACK } from "./debug-helpers";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    feedback: DebugBidFeedback | null;
  }

  let { feedback }: Props = $props();
</script>

<DebugSection
  title="Teaching"
  badge={feedback?.grade ?? null}
  badgeColor={feedback ? (GRADE_COLORS[feedback.grade] ?? GRADE_COLOR_FALLBACK) : GRADE_COLOR_FALLBACK}
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
          {#each tr.acceptableBids as ab, i (ab.call.type + (ab.call.type === 'bid' ? ab.call.level + ab.call.strain : '') + ':' + i)}
            <div class="text-[10px] leading-tight">
              <span class="text-teal-300">{fmtCall(ab.call)}</span>
              <span class="text-text-primary ml-0.5">{ab.meaning ?? ""}</span>
              <span class="text-text-muted ml-0.5">({ab.tier ?? ""}{ab.fullCredit ? ", full credit" : ""})</span>
            </div>
          {/each}
        </DebugSection>
      {/if}
      {#if tr.nearMissCalls && tr.nearMissCalls.length > 0}
        <DebugSection title="Near misses" count={tr.nearMissCalls.length} nested>
          {#each tr.nearMissCalls as nm, i (nm.call.type + (nm.call.type === 'bid' ? nm.call.level + nm.call.strain : '') + ':' + i)}
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
