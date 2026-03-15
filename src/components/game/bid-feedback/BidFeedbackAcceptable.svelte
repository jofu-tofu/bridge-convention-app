<script lang="ts">
  import type { BidFeedback } from "../../../stores/game.svelte";
  import { formatCall } from "../../../core/display/format";

  interface Props {
    feedback: BidFeedback;
    practicalRec: BidFeedback['practicalRecommendation'];
    showPracticalNote: boolean;
  }

  let { feedback, practicalRec, showPracticalNote }: Props = $props();
</script>

<!-- Acceptable bid — teal flash -->
<div
  class="rounded-[--radius-md] border-2 border-teal-500/60 bg-teal-950/80 px-3 py-3 text-center min-w-0"
  role="alert"
>
  <p class="text-teal-300 font-semibold text-sm">Acceptable!</p>
  <p class="text-teal-400 font-mono text-lg mt-1">
    {formatCall(feedback.userCall)}
  </p>
  {#if feedback.teachingResolution}
    <p class="text-teal-200 text-xs mt-1">
      Textbook bid is <span class="font-mono">{formatCall(feedback.teachingResolution.primaryBid)}</span>
    </p>
  {/if}
  {#if showPracticalNote && practicalRec}
    <p class="text-amber-300/70 text-xs mt-2 italic" data-testid="practical-note">
      Experienced players might prefer <span class="font-mono font-semibold">{formatCall(practicalRec.topCandidateCall)}</span> here — {practicalRec.rationale}
    </p>
  {/if}
</div>
