<script lang="ts">
  import type { BidFeedback } from "../../../stores/game.svelte";
  import { formatCall } from "../../../core/display/format";
  import { callsMatch } from "../../../engine/call-helpers";

  interface Props {
    feedback: BidFeedback;
    onContinue: () => void;
    onSkipToReview: () => void;
    onRetry?: () => void;
    showPracticalNote: boolean;
    practicalRec: BidFeedback['practicalRecommendation'];
  }

  let { feedback, onContinue, onSkipToReview, onRetry, showPracticalNote, practicalRec }: Props = $props();
</script>

<!-- Near miss — amber/orange feedback -->
<div
  class="rounded-[--radius-md] border-2 border-amber-500/60 bg-amber-950/80 px-3 py-3 min-w-0"
  role="alert"
>
  <div class="flex items-center justify-between mb-2">
    <div class="flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-400 shrink-0" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span class="text-amber-300 font-semibold text-sm">Near miss</span>
      <span class="font-mono font-bold text-sm text-amber-200">{formatCall(feedback.userCall)}</span>
    </div>
    <div class="flex items-center gap-1">
      {#if onRetry}
        <button
          type="button"
          class="p-1.5 rounded hover:bg-amber-800/50 text-amber-300 hover:text-amber-100 transition-colors cursor-pointer"
          onclick={onRetry}
          title="Try Again"
          aria-label="Try again"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        </button>
      {/if}
      <button
        type="button"
        class="p-1.5 rounded hover:bg-amber-800/50 text-amber-300 hover:text-amber-100 transition-colors cursor-pointer"
        onclick={onContinue}
        title="Continue"
        aria-label="Continue"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
      </button>
      <button
        type="button"
        class="p-1.5 rounded hover:bg-amber-800/50 text-amber-400/50 hover:text-amber-200 transition-colors cursor-pointer"
        onclick={onSkipToReview}
        title="Skip to Review"
        aria-label="Skip to review"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
      </button>
    </div>
  </div>
  {#if feedback.teachingResolution}
    <p class="text-amber-200/80 text-xs">
      The correct bid is <span class="font-mono font-semibold">{formatCall(feedback.teachingResolution.primaryBid)}</span>
    </p>
    {#if feedback.teachingResolution.nearMissCalls}
      {@const match = feedback.teachingResolution.nearMissCalls.find(
        entry => callsMatch(entry.call, feedback.userCall),
      )}
      {#if match}
        <p class="text-amber-300/60 text-xs mt-1" data-testid="near-miss-reason">{match.reason}</p>
      {/if}
    {/if}
  {/if}
  {#if showPracticalNote && practicalRec}
    <p class="text-amber-300/70 text-xs mt-2 italic" data-testid="practical-note">
      Experienced players might prefer <span class="font-mono font-semibold">{formatCall(practicalRec.topCandidateCall)}</span> here — {practicalRec.rationale}
    </p>
  {/if}
</div>
