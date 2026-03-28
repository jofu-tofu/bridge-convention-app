<script lang="ts">
  import type { BidFeedbackBaseProps } from "./types";
  import { formatCall } from "../../../service";
  import { formatAmbiguity } from "./BidFeedbackPanel";
  import PracticalRecommendationNote from "./PracticalRecommendationNote.svelte";
  import BidFeedbackShell from "../../shared/BidFeedbackShell.svelte";

  interface Props extends BidFeedbackBaseProps {}

  let { feedback, teaching, practicalRec, showPracticalNote }: Props = $props();

  const ambiguityNote = $derived(
    teaching?.ambiguityScore != null ? formatAmbiguity(teaching.ambiguityScore) : null, // eslint-disable-line eqeqeq -- intentional nullish check
  );
</script>

<!-- Correct bid — green flash -->
<BidFeedbackShell variant="correct" centered>
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
    <PracticalRecommendationNote {practicalRec} />
  {/if}
</BidFeedbackShell>
