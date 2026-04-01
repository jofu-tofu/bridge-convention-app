<script lang="ts">
  import type { ViewportBidFeedback, TeachingDetail, HandEvaluationView } from "../../../service";
  import { callsMatch, ViewportBidGrade } from "../../../service";
  import BidFeedbackCorrect from "./BidFeedbackCorrect.svelte";
  import BidFeedbackIncorrect from "./BidFeedbackIncorrect.svelte";

  interface Props {
    feedback: ViewportBidFeedback;
    teaching: TeachingDetail | null;
    onRetry: () => void;
    onContinue?: () => void;
    handEval?: HandEvaluationView | null;
    handSummary?: string | null;
  }

  let { feedback, teaching, onRetry, onContinue, handEval = null, handSummary = null }: Props = $props();

  const practicalRec = $derived(teaching?.practicalRecommendation);
  const showPracticalNote = $derived(
    practicalRec != null && // eslint-disable-line eqeqeq -- intentional nullish check
    feedback.correctCall != null && // eslint-disable-line eqeqeq -- intentional nullish check
    !callsMatch(practicalRec.topCandidateCall, feedback.correctCall)
  );
</script>

{#if feedback.grade === ViewportBidGrade.Correct || feedback.grade === ViewportBidGrade.Acceptable}
  <BidFeedbackCorrect {feedback} {teaching} {practicalRec} {showPracticalNote} {handEval} {handSummary} {onContinue} />
{:else if feedback.grade === ViewportBidGrade.NearMiss}
  <BidFeedbackIncorrect {feedback} {teaching} {onRetry} {showPracticalNote} {practicalRec} {handEval} {handSummary} variant="near-miss" />
{:else}
  <BidFeedbackIncorrect {feedback} {teaching} {onRetry} {showPracticalNote} {practicalRec} {handEval} {handSummary} />
{/if}
