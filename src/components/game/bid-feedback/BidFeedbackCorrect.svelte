<script lang="ts">
  import type { BidFeedbackBaseProps } from "./types";
  import { formatCall } from "../../../core/display/format";
  import { formatAmbiguity } from "./BidFeedbackPanel";

  interface Props extends BidFeedbackBaseProps {}

  let { feedback, teaching, practicalRec, showPracticalNote }: Props = $props();

  const ambiguityNote = $derived(
    teaching?.ambiguityScore != null ? formatAmbiguity(teaching.ambiguityScore) : null, // eslint-disable-line eqeqeq -- intentional nullish check
  );
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
  {#if feedback.grade === "correct-not-preferred" && teaching?.primaryBid}
    <p class="text-fb-correct-dim/70 text-[--text-label] mt-1" data-testid="not-preferred-note">
      Though <span class="font-mono font-semibold">{formatCall(teaching.primaryBid)}</span> is preferred
    </p>
  {/if}
  {#if ambiguityNote}
    <p class="text-fb-correct-dim/50 text-[--text-annotation] mt-1 italic">{ambiguityNote}</p>
  {/if}
  {#if showPracticalNote && practicalRec}
    <p class="text-fb-near-miss-text/70 text-[--text-label] mt-2 italic" data-testid="practical-note">
      Experienced players might prefer <span class="font-mono font-semibold">{formatCall(practicalRec.topCandidateCall)}</span> here — {practicalRec.rationale}
    </p>
  {/if}
</div>
