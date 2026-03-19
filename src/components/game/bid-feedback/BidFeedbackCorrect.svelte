<script lang="ts">
  import type { BidFeedback } from "../../../stores/game.svelte";
  import { BidGrade } from "../../../teaching/teaching-resolution";
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
  class="rounded-[--radius-md] border-2 border-fb-correct/60 bg-fb-correct-bg/80 px-3 py-3 text-center min-w-0"
  role="alert"
>
  <p class="text-fb-correct-text font-semibold text-[--text-detail]">Correct!</p>
  <p class="text-fb-correct-emphasis font-mono text-[--text-value] mt-1">
    {formatCall(feedback.userCall)}
  </p>
  {#if feedback.grade === BidGrade.CorrectNotPreferred && feedback.teachingResolution}
    <p class="text-fb-correct-dim/70 text-[--text-label] mt-1" data-testid="not-preferred-note">
      Though <span class="font-mono font-semibold">{formatCall(feedback.teachingResolution.primaryBid)}</span> is preferred
    </p>
  {/if}
  {#if showPracticalNote && practicalRec}
    <p class="text-fb-near-miss-text/70 text-[--text-label] mt-2 italic" data-testid="practical-note">
      Experienced players might prefer <span class="font-mono font-semibold">{formatCall(practicalRec.topCandidateCall)}</span> here — {practicalRec.rationale}
    </p>
  {/if}
</div>
