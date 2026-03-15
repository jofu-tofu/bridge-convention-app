<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import type { Call } from "../../engine/types";
  import type { BidFeedback } from "../../stores/game.svelte";
  import { BidGrade } from "../../stores/bidding.svelte";
  import { formatCall } from "../../core/display/format";
  import { callsMatch } from "../../engine/call-helpers";
  import {
    formatRelationKind,
    formatEliminationStage,
    formatModuleRole,
    roleColorClasses,
    whyNotGradeClasses,
    isArtificialEncoder,
    formatEncoderKind,
  } from "./BidFeedbackPanel";

  interface Props {
    feedback: BidFeedback;
    onContinue: () => void;
    onSkipToReview: () => void;
    onRetry?: () => void;
  }

  let { feedback, onContinue, onSkipToReview, onRetry }: Props = $props();

  let showAnswer = $state(false);
  let showDecisionSpace = $state(false);
  let expandedWhyNot = new SvelteSet<number>();
  const acceptableBids = $derived(feedback.teachingResolution?.acceptableBids ?? []);

  // Teaching projection — unified contract from both pipelines
  const projection = $derived(feedback.teachingProjection);

  // Meaning display label from the live meaning view
  const liveMeaning = $derived(
    projection?.meaningViews.find(v => v.status === "live"),
  );
  const meaningLabel = $derived(liveMeaning?.displayLabel ?? feedback.expectedResult?.meaning);

  // Conditions from primary explanation (kind="condition" nodes)
  const conditionNodes = $derived(
    projection?.primaryExplanation.filter(n => n.kind === "condition") ?? [],
  );

  // WhyNot entries — alternative bids with explanations
  const whyNotEntries = $derived(projection?.whyNot ?? []);

  // Convention contributions — only show when multiple modules contributed
  const contributions = $derived(
    (projection?.conventionsApplied ?? []).filter(c => c.meaningsProposed.length > 0),
  );
  const showContributions = $derived(contributions.length > 1);

  // Multi-rationale detection: a call correct for more than one distinct reason
  const multiRationaleCall = $derived(
    projection?.callViews.find(
      cv => cv.status === "truth" && cv.projectionKind === "multi-rationale-same-call",
    ) ?? null,
  );

  // Decision space: all evaluated meanings (live + eliminated)
  const eliminatedMeanings = $derived(
    (projection?.meaningViews ?? []).filter(v => v.status === "eliminated"),
  );
  const showDecisionSpaceToggle = $derived(eliminatedMeanings.length > 0);

  // Partner hand space summary
  const handSpace = $derived(projection?.handSpace);
  const hasPartnerInfo = $derived(
    handSpace != null && // eslint-disable-line eqeqeq -- intentional nullish check
    handSpace.partnerSummary != null, // eslint-disable-line eqeqeq -- intentional nullish check
  );

  // Encoding explanation — show when the meaning was encoded via an artificial mechanism
  const encodingNote = $derived(
    feedback.encodingTrace && isArtificialEncoder(feedback.encodingTrace.encoderKind)
      ? formatEncoderKind(feedback.encodingTrace.encoderKind)
      : null,
  );

  // Divergence note: candidateSet display removed — not available in current pipeline

  // Reset showAnswer and expanded state when feedback changes (new wrong bid)
  let prevFeedback: BidFeedback | undefined;
  $effect.pre(() => {
    if (feedback !== prevFeedback) {
      showAnswer = false;
      showDecisionSpace = false;
      expandedWhyNot.clear();
    }
    prevFeedback = feedback;
  });

  function toggleWhyNot(index: number) {
    if (expandedWhyNot.has(index)) {
      expandedWhyNot.delete(index);
    } else {
      expandedWhyNot.add(index);
    }
  }

  const practicalRec = $derived(feedback.practicalRecommendation);
  const showPracticalNote = $derived(
    practicalRec != null && // eslint-disable-line eqeqeq -- intentional nullish check
    feedback.expectedResult != null && // eslint-disable-line eqeqeq -- intentional nullish check
    !callsMatch(practicalRec.topCandidateCall, feedback.expectedResult.call)
  );

  function isAcceptableWhyNot(call: Call): boolean {
    return acceptableBids.some((acceptable) => callsMatch(acceptable.call, call));
  }
</script>

{#if feedback.grade === BidGrade.Correct || feedback.grade === BidGrade.CorrectNotPreferred}
  <!-- Correct bid — green flash -->
  <div
    class="rounded-[--radius-md] border-2 border-green-500/60 bg-green-950/80 px-3 py-3 text-center min-w-0"
    role="alert"
  >
    <p class="text-green-300 font-semibold text-sm">Correct!</p>
    <p class="text-green-400 font-mono text-lg mt-1">
      {formatCall(feedback.userCall)}
    </p>
    {#if feedback.grade === BidGrade.CorrectNotPreferred && feedback.teachingResolution}
      <p class="text-green-200/70 text-xs mt-1" data-testid="not-preferred-note">
        Though <span class="font-mono font-semibold">{formatCall(feedback.teachingResolution.primaryBid)}</span> is preferred
      </p>
    {/if}
    {#if showPracticalNote && practicalRec}
      <p class="text-amber-300/70 text-xs mt-2 italic" data-testid="practical-note">
        Experienced players might prefer <span class="font-mono font-semibold">{formatCall(practicalRec.topCandidateCall)}</span> here — {practicalRec.rationale}
      </p>
    {/if}
  </div>
{:else if feedback.grade === BidGrade.Acceptable}
  <!-- Acceptable bid — teal flash -->
  <div
    class="rounded-[--radius-md] border-2 border-teal-500/60 bg-teal-950/80 px-3 py-3 text-center min-w-0"
    role="alert"
  >
    <p class="text-teal-300 font-semibold text-sm">Acceptable!</p>
    <p class="text-teal-400 font-mono text-lg mt-1">
      {formatCall(feedback.userCall)}
    </p>
    {#if feedback.teachingResolution}
      <p class="text-teal-200 text-xs mt-1">
        Textbook bid is <span class="font-mono">{formatCall(feedback.teachingResolution.primaryBid)}</span>
      </p>
    {/if}
    {#if showPracticalNote && practicalRec}
      <p class="text-amber-300/70 text-xs mt-2 italic" data-testid="practical-note">
        Experienced players might prefer <span class="font-mono font-semibold">{formatCall(practicalRec.topCandidateCall)}</span> here — {practicalRec.rationale}
      </p>
    {/if}
  </div>
{:else if feedback.grade === BidGrade.NearMiss}
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
{:else}
  <!-- Wrong bid — red feedback -->
  <div
    class="rounded-[--radius-md] border-2 border-red-500/60 bg-red-950/80 px-3 py-3 min-w-0"
    role="alert"
  >
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <span class="text-red-300 font-semibold text-sm">Incorrect</span>
        <span class="font-mono font-bold text-sm text-red-200">{formatCall(feedback.userCall)}</span>
      </div>
      <div class="flex items-center gap-1">
        <!-- Try Again (redo) -->
        {#if onRetry}
          <button
            type="button"
            class="p-1.5 rounded hover:bg-red-800/50 text-red-300 hover:text-red-100 transition-colors cursor-pointer"
            onclick={onRetry}
            title="Try Again"
            aria-label="Try again"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </button>
        {/if}
        <!-- Show/Hide Answer (eye toggle) -->
        <button
          type="button"
          class="p-1.5 rounded hover:bg-red-800/50 text-red-300 hover:text-red-100 transition-colors cursor-pointer"
          onclick={() => { showAnswer = !showAnswer; }}
          title={showAnswer ? "Hide Answer" : "Show Answer"}
          aria-label={showAnswer ? "Hide answer" : "Show answer"}
        >
          {#if showAnswer}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          {/if}
        </button>
        <!-- Continue (forward arrow) -->
        <button
          type="button"
          class="p-1.5 rounded hover:bg-red-800/50 text-red-300 hover:text-red-100 transition-colors cursor-pointer"
          onclick={onContinue}
          title="Continue"
          aria-label="Continue"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
        </button>
        <!-- Skip to Review (skip-forward) -->
        <button
          type="button"
          class="p-1.5 rounded hover:bg-red-800/50 text-red-400/50 hover:text-red-200 transition-colors cursor-pointer"
          onclick={onSkipToReview}
          title="Skip to Review"
          aria-label="Skip to review"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
        </button>
      </div>
    </div>

    {#if showAnswer && feedback.expectedResult}
      <div
        class="bg-red-900/50 rounded px-3 py-2 mb-3 border border-red-500/30 min-w-0 space-y-2"
      >
        <!-- 1. Correct bid + meaning -->
        <div>
          <p class="text-xs text-red-300/70 mb-0.5">Correct bid:</p>
          <p class="font-mono font-bold text-base text-red-100">
            {formatCall(feedback.expectedResult.call)}
            {#if meaningLabel}
              <span class="font-sans font-normal text-sm text-red-200/80">— {meaningLabel}</span>
            {/if}
          </p>
          {#if multiRationaleCall}
            <p class="text-xs text-sky-300/70 mt-0.5">
              Correct for more than one reason
              {#if multiRationaleCall.supportingMeanings.length > 0}
                — supported by {multiRationaleCall.supportingMeanings.length} meanings
              {/if}
            </p>
          {/if}
          {#if encodingNote}
            <p class="text-xs text-violet-300/60 mt-0.5 italic">{encodingNote}</p>
          {/if}
        </div>

        <!-- 2. Hand summary -->
        {#if feedback.expectedResult.handSummary}
          <div>
            <p class="text-xs text-red-300/70 mb-0.5">Your hand:</p>
            <p class="font-mono text-sm text-red-200">{feedback.expectedResult.handSummary}</p>
          </div>
        {/if}

        <!-- 3. Conditions from teaching projection -->
        {#if conditionNodes.length > 0}
          <ul class="space-y-1" role="list" aria-label="Bid conditions">
            {#each conditionNodes as node, ci (node.content + '-' + ci)}
              <li class="flex items-center gap-1.5">
                <span
                  class={node.passed
                    ? "text-accent-success"
                    : "text-accent-danger"}
                  aria-hidden="true">{node.passed ? "✓" : "✗"}</span
                >
                <span class="sr-only"
                  >{node.passed ? "Passed:" : "Failed:"}</span
                >
                <span class="text-red-200/70 break-words text-xs">{node.content}</span>
              </li>
            {/each}
          </ul>
        {:else if feedback.expectedResult.explanation}
          <p class="text-red-200/50 text-xs leading-tight">
            {feedback.expectedResult.explanation}
          </p>
        {/if}

        <!-- 4. Partner hand space -->
        {#if hasPartnerInfo && handSpace}
          <div class="pt-1 border-t border-red-500/20">
            <p class="text-xs text-red-300/70 mb-0.5">What we know about partner:</p>
            <p class="text-xs text-red-200/70">{handSpace.partnerSummary}</p>
            {#if handSpace.archetypes && handSpace.archetypes.length > 0}
              <div class="mt-1 space-y-0.5">
                {#each handSpace.archetypes as archetype (archetype.label)}
                  <p class="text-[10px] text-red-300/50 font-mono">
                    {archetype.label}: {archetype.hcpRange.min}-{archetype.hcpRange.max} HCP, {archetype.shapePattern}
                  </p>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- 5. Convention contributions -->
        {#if showContributions}
          <div class="pt-1 border-t border-red-500/20">
            <p class="text-xs text-red-300/70 mb-1">Conventions evaluated:</p>
            <div class="flex flex-wrap gap-1">
              {#each contributions as contrib (contrib.moduleId)}
                <span
                  class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] {roleColorClasses(contrib.role)}"
                >
                  <span class="font-medium">{contrib.moduleId}</span>
                  <span class="opacity-70">{formatModuleRole(contrib.role)}</span>
                </span>
              {/each}
            </div>
          </div>
        {/if}

        <!-- 6. Other Bids (from whyNot entries) -->
        {#if whyNotEntries.length > 0}
          <div class="pt-1 border-t border-red-500/20">
            <p class="text-xs text-red-300/70 mb-1">Other bids:</p>
            <div class="space-y-1">
              {#each whyNotEntries as entry, wi (wi)}
                <div class="text-xs">
                  <button
                    type="button"
                    class="flex items-center gap-1 text-left cursor-pointer hover:text-red-100 transition-colors w-full flex-wrap"
                    onclick={() => toggleWhyNot(wi)}
                    aria-expanded={expandedWhyNot.has(wi)}
                  >
                    <span class="text-red-300/50 shrink-0">{expandedWhyNot.has(wi) ? "▾" : "▸"}</span>
                    <span class="font-mono font-bold text-red-200/80">{formatCall(entry.call)}</span>
                    {#if isAcceptableWhyNot(entry.call)}
                      <span class="rounded bg-teal-900/70 border border-teal-500/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-teal-200">
                        acceptable
                      </span>
                    {:else}
                      {@const gradeStyle = whyNotGradeClasses(entry.grade)}
                      <span class="rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide {gradeStyle.badge}">
                        {gradeStyle.label}
                      </span>
                    {/if}
                    {#if entry.familyRelation}
                      <span class="text-[10px] text-purple-300/60 italic">
                        {formatRelationKind(entry.familyRelation.kind)}
                      </span>
                    {/if}
                    {#if entry.eliminationStage}
                      <span class="text-[10px] text-zinc-400/50">
                        ({formatEliminationStage(entry.eliminationStage)})
                      </span>
                    {/if}
                  </button>
                  {#if expandedWhyNot.has(wi) && entry.explanation.length > 0}
                    <ul class="ml-4 mt-0.5 space-y-0.5" role="list" aria-label="Why not this bid">
                      {#each entry.explanation as expNode, ei (expNode.content + '-' + ei)}
                        <li class="flex items-center gap-1.5 text-red-300/50">
                          {#if expNode.kind === "condition"}
                            <span class={expNode.passed ? "text-accent-success" : "text-accent-danger"} aria-hidden="true">{expNode.passed ? "✓" : "✗"}</span>
                          {:else}
                            <span class="text-red-300/30" aria-hidden="true">·</span>
                          {/if}
                          <span>{expNode.content}</span>
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- 7. Decision space: meanings evaluated (expandable) -->
        {#if showDecisionSpaceToggle}
          <div class="pt-1 border-t border-red-500/20">
            <button
              type="button"
              class="text-xs text-red-300/50 hover:text-red-200 transition-colors cursor-pointer flex items-center gap-1"
              onclick={() => { showDecisionSpace = !showDecisionSpace; }}
              aria-expanded={showDecisionSpace}
            >
              <span class="shrink-0">{showDecisionSpace ? "▾" : "▸"}</span>
              <span>Decision space ({eliminatedMeanings.length} eliminated meaning{eliminatedMeanings.length === 1 ? '' : 's'})</span>
            </button>
            {#if showDecisionSpace}
              <div class="mt-1 space-y-0.5 ml-3">
                {#each eliminatedMeanings as mv (mv.meaningId)}
                  <div class="text-[10px] flex items-start gap-1.5">
                    <span class="text-red-400/50 shrink-0" aria-hidden="true">✗</span>
                    <div>
                      <span class="text-red-200/60">{mv.displayLabel}</span>
                      {#if mv.eliminationReason}
                        <span class="text-red-300/40"> — {mv.eliminationReason}</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

      </div>
    {/if}

    {#if showPracticalNote && practicalRec}
      <p class="text-amber-300/70 text-xs mt-2 italic" data-testid="practical-note">
        Experienced players might prefer <span class="font-mono font-semibold">{formatCall(practicalRec.topCandidateCall)}</span> here — {practicalRec.rationale}
      </p>
    {/if}

  </div>
{/if}
