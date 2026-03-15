<script lang="ts">
  import type { BidFeedback } from "../../stores/game.svelte";
  import { BidGrade } from "../../stores/bidding.svelte";
  import { callsMatch } from "../../engine/call-helpers";
  import BidFeedbackCorrect from "./BidFeedbackCorrect.svelte";
  import BidFeedbackAcceptable from "./BidFeedbackAcceptable.svelte";
  import BidFeedbackNearMiss from "./BidFeedbackNearMiss.svelte";
  import BidFeedbackIncorrect from "./BidFeedbackIncorrect.svelte";

  interface Props {
    feedback: BidFeedback;
    onContinue: () => void;
    onSkipToReview: () => void;
    onRetry?: () => void;
  }

  let { feedback, onContinue, onSkipToReview, onRetry }: Props = $props();

  const practicalRec = $derived(feedback.practicalRecommendation);
  const showPracticalNote = $derived(
    practicalRec != null && // eslint-disable-line eqeqeq -- intentional nullish check
    feedback.expectedResult != null && // eslint-disable-line eqeqeq -- intentional nullish check
    !callsMatch(practicalRec.topCandidateCall, feedback.expectedResult.call)
  );
</script>

{#if feedback.grade === BidGrade.Correct || feedback.grade === BidGrade.CorrectNotPreferred}
  <BidFeedbackCorrect {feedback} {practicalRec} {showPracticalNote} />
{:else if feedback.grade === BidGrade.Acceptable}
  <BidFeedbackAcceptable {feedback} {practicalRec} {showPracticalNote} />
{:else if feedback.grade === BidGrade.NearMiss}
  <BidFeedbackNearMiss {feedback} {onContinue} {onSkipToReview} {onRetry} {showPracticalNote} {practicalRec} />
{:else}
  <BidFeedbackIncorrect {feedback} {onContinue} {onSkipToReview} {onRetry} {showPracticalNote} {practicalRec} />
{/if}
