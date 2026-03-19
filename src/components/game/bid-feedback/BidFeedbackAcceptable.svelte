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
  class="rounded-[--radius-md] border-2 border-fb-acceptable/60 bg-fb-acceptable-bg/80 px-3 py-3 text-center min-w-0"
  role="alert"
>
  <p class="text-fb-acceptable-text font-semibold text-[--text-detail]">Acceptable!</p>
  <p class="text-fb-acceptable-emphasis font-mono text-[--text-value] mt-1">
    {formatCall(feedback.userCall)}
  </p>
  {#if feedback.teachingResolution}
    <p class="text-fb-acceptable-dim text-[--text-label] mt-1">
      Textbook bid is <span class="font-mono">{formatCall(feedback.teachingResolution.primaryBid)}</span>
    </p>
  {/if}
  {#if showPracticalNote && practicalRec}
    <p class="text-fb-near-miss-text/70 text-[--text-label] mt-2 italic" data-testid="practical-note">
      Experienced players might prefer <span class="font-mono font-semibold">{formatCall(practicalRec.topCandidateCall)}</span> here — {practicalRec.rationale}
    </p>
  {/if}
</div>
