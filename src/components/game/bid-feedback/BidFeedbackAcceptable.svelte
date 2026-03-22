<script lang="ts">
  import type { BidFeedbackBaseProps } from "./types";
  import { formatCall } from "../../../core/display/format";
  import { formatAmbiguity } from "./BidFeedbackPanel";
  import PracticalRecommendationNote from "./PracticalRecommendationNote.svelte";

  interface Props extends BidFeedbackBaseProps {}

  let { feedback, teaching, practicalRec, showPracticalNote }: Props = $props();

  const ambiguityNote = $derived(
    teaching?.ambiguityScore != null ? formatAmbiguity(teaching.ambiguityScore) : null, // eslint-disable-line eqeqeq -- intentional nullish check
  );
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
  {#if teaching?.primaryBid}
    <p class="text-fb-acceptable-dim text-[--text-label] mt-1">
      Textbook bid is <span class="font-mono">{formatCall(teaching.primaryBid)}</span>
    </p>
  {/if}
  {#if ambiguityNote}
    <p class="text-fb-acceptable-dim/60 text-[--text-annotation] mt-1 italic">{ambiguityNote}</p>
  {/if}
  {#if showPracticalNote && practicalRec}
    <PracticalRecommendationNote {practicalRec} />
  {/if}
</div>
