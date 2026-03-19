<script lang="ts">
  import type { BidFeedbackInteractiveProps } from "./types";
  import { formatCall } from "../../../core/display/format";
  import { callsMatch } from "../../../engine/call-helpers";

  interface Props extends BidFeedbackInteractiveProps {}

  let { feedback, teaching, onRetry, showPracticalNote, practicalRec }: Props = $props();
</script>

<!-- Near miss — amber/orange feedback -->
<div
  class="rounded-[--radius-md] border-2 border-fb-near-miss/60 bg-fb-near-miss-bg/80 px-3 py-3 min-w-0"
  role="alert"
>
  <div class="flex items-center justify-between mb-2">
    <div class="flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-fb-near-miss-emphasis shrink-0" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span class="text-fb-near-miss-text font-semibold text-[--text-detail]">Near miss</span>
      <span class="font-mono font-bold text-[--text-detail] text-fb-near-miss-dim">{formatCall(feedback.userCall)}</span>
    </div>
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="p-1.5 rounded hover:bg-fb-near-miss-surface/50 text-fb-near-miss-text hover:text-fb-near-miss-bright transition-colors cursor-pointer"
        onclick={onRetry}
        title="Try Again"
        aria-label="Try again"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
      </button>
    </div>
  </div>
  {#if teaching?.primaryBid}
    <p class="text-fb-near-miss-dim/80 text-[--text-label]">
      The correct bid is <span class="font-mono font-semibold">{formatCall(teaching.primaryBid)}</span>
    </p>
    {#if teaching.nearMissCalls}
      {@const match = teaching.nearMissCalls.find(
        entry => callsMatch(entry.call, feedback.userCall),
      )}
      {#if match}
        <p class="text-fb-near-miss-text/60 text-[--text-label] mt-1" data-testid="near-miss-reason">{match.reason}</p>
      {/if}
    {/if}
  {/if}
  {#if showPracticalNote && practicalRec}
    <p class="text-fb-near-miss-text/70 text-[--text-label] mt-2 italic" data-testid="practical-note">
      Experienced players might prefer <span class="font-mono font-semibold">{formatCall(practicalRec.topCandidateCall)}</span> here — {practicalRec.rationale}
    </p>
  {/if}
</div>
