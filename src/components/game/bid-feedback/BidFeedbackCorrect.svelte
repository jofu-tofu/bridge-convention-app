<script lang="ts">
  import type { BidFeedback } from "../../../stores/game.svelte";
  import { BidGrade } from "../../../stores/bidding.svelte";
  import { formatCall } from "../../../core/display/format";

  interface Props {
    feedback: BidFeedback;
    practicalRec: BidFeedback['practicalRecommendation'];
    showPracticalNote: boolean;
  }

  let { feedback, practicalRec, showPracticalNote }: Props = $props();
</script>

<!-- Correct bid — green flash -->
<div
  class="rounded-[--radius-md] border-2 border-green-500/60 bg-green-950/80 px-3 py-3 text-center min-w-0"
  role="alert"
>
  <p class="text-green-300 font-semibold text-sm">Correct!</p>
  <p class="text-green-400 font-mono text-lg mt-1">
    {formatCall(feedback.userCall)}
  </p>
  {#if feedback.grade === BidGrade.CorrectNotPreferred && feedback.teachingResolution}
    <p class="text-green-200/70 text-xs mt-1" data-testid="not-preferred-note">
      Though <span class="font-mono font-semibold">{formatCall(feedback.teachingResolution.primaryBid)}</span> is preferred
    </p>
  {/if}
  {#if showPracticalNote && practicalRec}
    <p class="text-amber-300/70 text-xs mt-2 italic" data-testid="practical-note">
      Experienced players might prefer <span class="font-mono font-semibold">{formatCall(practicalRec.topCandidateCall)}</span> here — {practicalRec.rationale}
    </p>
  {/if}
</div>
