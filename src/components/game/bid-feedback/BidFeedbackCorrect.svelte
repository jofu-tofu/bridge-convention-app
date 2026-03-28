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

  const passedConditions = $derived(
    (feedback.conditions ?? []).filter((c) => c.passed).slice(0, 2),
  );
</script>

<!-- Correct bid — green flash -->
<BidFeedbackShell variant="correct" centered>
  <p class="text-fb-correct-text font-semibold text-[--text-detail]">Correct!</p>
  <p class="text-fb-correct-emphasis font-mono text-[--text-value] mt-1">
    {formatCall(feedback.userCall)}
  </p>
  {#if feedback.correctBidExplanation}
    <p class="text-fb-correct-dim/70 text-[--text-label] mt-1">{feedback.correctBidExplanation}</p>
  {/if}
  {#if feedback.grade === "correct-not-preferred" && teaching?.primaryBid}
    <p class="text-fb-correct-dim/70 text-[--text-label] mt-1" data-testid="not-preferred-note">
      Though <span class="font-mono font-semibold">{formatCall(teaching.primaryBid)}</span> is preferred
    </p>
  {/if}
  {#if passedConditions.length > 0}
    <div class="mt-1.5 flex flex-col gap-0.5">
      {#each passedConditions as cond (cond.label)}
        <p class="text-fb-correct-dim/60 text-[--text-annotation]">✓ {cond.label}</p>
      {/each}
    </div>
  {/if}
  {#if ambiguityNote}
    <p class="text-fb-correct-dim/50 text-[--text-annotation] mt-1 italic">{ambiguityNote}</p>
  {/if}
  {#if showPracticalNote && practicalRec}
    <PracticalRecommendationNote {practicalRec} />
  {/if}
</BidFeedbackShell>
