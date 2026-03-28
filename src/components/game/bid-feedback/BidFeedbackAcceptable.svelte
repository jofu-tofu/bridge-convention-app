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

<!-- Acceptable bid — teal flash -->
<BidFeedbackShell variant="acceptable" centered>
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
</BidFeedbackShell>
