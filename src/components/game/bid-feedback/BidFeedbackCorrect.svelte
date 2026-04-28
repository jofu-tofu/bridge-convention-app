<script lang="ts">
  import type { BidFeedbackBaseProps } from "./types";
  import { formatCall, ViewportBidGrade } from "../../../service";
  import PracticalRecommendationNote from "./PracticalRecommendationNote.svelte";
  import BidFeedbackShell from "../../shared/BidFeedbackShell.svelte";

  interface Props extends BidFeedbackBaseProps {
    onContinue?: () => void;
  }

  let { feedback, teaching, practicalRec, showPracticalNote, onContinue }: Props = $props();

  const isAcceptable = $derived(feedback.grade === ViewportBidGrade.Acceptable);

  // truth_set always contains the primary call; >1 means real alternatives exist.
  const hasOtherAcceptableBids = $derived((teaching?.acceptableBids?.length ?? 0) > 1);

  const passedConditions = $derived(
    (feedback.conditions ?? []).filter((c) => c.passed).slice(0, 2),
  );
</script>

<!-- Correct/Acceptable bid — green (correct) or teal (acceptable) -->
<BidFeedbackShell variant={isAcceptable ? "acceptable" : "correct"} centered>
  <p class="{isAcceptable ? 'text-fb-acceptable-text' : 'text-fb-correct-text'} font-semibold text-[--text-detail]">
    {isAcceptable ? "Acceptable!" : "Correct!"}
  </p>
  <p class="text-fb-correct-emphasis font-mono text-[--text-value] mt-1">
    {formatCall(feedback.userCall)}
  </p>
  {#if isAcceptable && feedback.correctBidExplanation}
    <p class="text-fb-correct-dim/70 text-[--text-label] mt-1">{feedback.correctBidExplanation}</p>
  {/if}
  {#if isAcceptable && teaching?.primaryBid}
    <p class="text-fb-correct-dim/70 text-[--text-label] mt-1" data-testid="not-preferred-note">
      Though <span class="font-mono font-semibold">{formatCall(teaching.primaryBid)}</span> is preferred
    </p>
  {/if}
  {#if isAcceptable && passedConditions.length > 0}
    <div class="mt-1.5 flex flex-col gap-0.5">
      {#each passedConditions as cond (cond.description)}
        <p class="text-fb-correct-dim/60 text-[--text-annotation]">✓ {cond.description}</p>
      {/each}
    </div>
  {/if}
  {#if hasOtherAcceptableBids && isAcceptable}
    <p class="text-fb-correct-dim/50 text-[--text-annotation] mt-1 italic">Other bids also work here</p>
  {/if}
  {#if showPracticalNote && practicalRec}
    <PracticalRecommendationNote {practicalRec} />
  {/if}
  {#if isAcceptable && onContinue}
    <button
      class="mt-3 w-full px-3 py-2 rounded-[--radius-md] font-medium text-[--text-body] bg-accent-primary hover:bg-accent-primary-hover text-text-on-accent cursor-pointer"
      onclick={onContinue}
      data-testid="acceptable-continue"
    >
      Continue
    </button>
  {/if}
</BidFeedbackShell>
