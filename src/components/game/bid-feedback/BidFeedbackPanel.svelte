<script lang="ts">
  import type { ViewportBidFeedback, TeachingDetail } from "../../../core/viewport";
  import { callsMatch } from "../../../engine/call-helpers";
  import BidFeedbackCorrect from "./BidFeedbackCorrect.svelte";
  import BidFeedbackAcceptable from "./BidFeedbackAcceptable.svelte";
  import BidFeedbackNearMiss from "./BidFeedbackNearMiss.svelte";
  import BidFeedbackIncorrect from "./BidFeedbackIncorrect.svelte";

  interface Props {
    feedback: ViewportBidFeedback;
    teaching: TeachingDetail | null;
    onRetry: () => void;
  }

  let { feedback, teaching, onRetry }: Props = $props();

  const practicalRec = $derived(teaching?.practicalRecommendation);
  const showPracticalNote = $derived(
    practicalRec != null && // eslint-disable-line eqeqeq -- intentional nullish check
    feedback.correctCall != null && // eslint-disable-line eqeqeq -- intentional nullish check
    !callsMatch(practicalRec.topCandidateCall, feedback.correctCall)
  );
</script>

{#if feedback.grade === "correct" || feedback.grade === "correct-not-preferred"}
  <BidFeedbackCorrect {feedback} {teaching} {practicalRec} {showPracticalNote} />
{:else if feedback.grade === "acceptable"}
  <BidFeedbackAcceptable {feedback} {teaching} {practicalRec} {showPracticalNote} />
{:else if feedback.grade === "near-miss"}
  <BidFeedbackNearMiss {feedback} {teaching} {onRetry} {showPracticalNote} {practicalRec} />
{:else}
  <BidFeedbackIncorrect {feedback} {teaching} {onRetry} {showPracticalNote} {practicalRec} />
{/if}
