<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import type { Call } from "../../../engine/types";
  import type { BidFeedbackInteractiveProps } from "./types";
  import type { ViewportBidFeedback } from "../../../core/viewport";
  import { formatCall } from "../../../core/display/format";
  import { callsMatch } from "../../../engine/call-helpers";
  import {
    formatEliminationStage,
    formatModuleRole,
    roleColorClasses,
    whyNotGradeClasses,
    isArtificialEncoder,
    formatEncoderKind,
    formatAmbiguity,
  } from "./BidFeedbackPanel";
  import { formatRuleName } from "../../../core/display/format";
  import ParseTreePanel from "./ParseTreePanel.svelte";
  import PracticalRecommendationNote from "./PracticalRecommendationNote.svelte";

  interface Props extends BidFeedbackInteractiveProps {}

  let { feedback, teaching, onRetry, showPracticalNote, practicalRec }: Props = $props();

  let showAnswer = $state(false);
  let showMoreDetails = $state(false);
  let showDecisionSpace = $state(false);
  let expandedWhyNot = new SvelteSet<number>();
  const acceptableBids = $derived(teaching?.acceptableBids ?? []);

  // Meaning display label from the live meaning view
  const liveMeaning = $derived(
    teaching?.meaningViews?.find(v => v.status === "live"),
  );
  const meaningLabel = $derived(liveMeaning?.displayLabel ?? feedback.correctBidLabel);

  // Conditions from primary explanation (kind="condition" nodes)
  const conditionNodes = $derived(
    teaching?.primaryExplanation?.filter(n => n.kind === "condition") ?? [],
  );

  // Split conditions: failing first (the key takeaway), then passing
  const failingConditions = $derived(conditionNodes.filter(n => !n.passed));
  const passingConditions = $derived(conditionNodes.filter(n => n.passed));

  // WhyNot entries — alternative bids with explanations
  const whyNotEntries = $derived(teaching?.whyNot ?? []);

  // The user's specific bid in whyNot (surface this prominently)
  const userBidWhyNot = $derived(
    whyNotEntries.find(e => callsMatch(e.call, feedback.userCall)),
  );

  // Remaining whyNot entries (excluding the user's bid)
  const otherWhyNotEntries = $derived(
    whyNotEntries.filter(e => !callsMatch(e.call, feedback.userCall)),
  );

  // Convention contributions — only show when multiple modules contributed
  const contributions = $derived(
    (teaching?.conventionsApplied ?? []).filter(c => c.meaningsProposed.length > 0),
  );
  const showContributions = $derived(contributions.length > 1);

  // Multi-rationale detection: a call correct for more than one distinct reason
  const multiRationaleCall = $derived(
    teaching?.callViews?.find(
      cv => cv.status === "truth" && cv.projectionKind === "multi-rationale-same-call",
    ) ?? null,
  );

  // Decision space: all evaluated meanings (live + eliminated)
  const eliminatedMeanings = $derived(
    (teaching?.meaningViews ?? []).filter(v => v.status === "eliminated"),
  );
  const showDecisionSpaceToggle = $derived(eliminatedMeanings.length > 0);

  // Partner hand space summary
  const hasPartnerInfo = $derived(teaching?.partnerSummary != null); // eslint-disable-line eqeqeq -- intentional nullish check

  // Encoding explanation — show when the meaning was encoded via an artificial mechanism
  const encodingNote = $derived(
    teaching?.encoderKind && isArtificialEncoder(teaching.encoderKind)
      ? formatEncoderKind(teaching.encoderKind)
      : null,
  );

  // Decision metadata — ambiguity and grading type
  const ambiguityNote = $derived(
    teaching?.ambiguityScore != null ? formatAmbiguity(teaching.ambiguityScore) : null, // eslint-disable-line eqeqeq -- intentional nullish check
  );

  // Practical score breakdown
  const scoreBreakdown = $derived(teaching?.practicalScoreBreakdown ?? null);
  let showScoreBreakdown = $state(false);

  // Fallback reached — no convention surface matched
  const fallbackNote = $derived(teaching?.fallbackReached === true);

  // Parse tree — decision chain view
  const parseTree = $derived(teaching?.parseTree ?? null);

  // Has any "more details" content worth showing
  const hasMoreDetails = $derived(
    showContributions ||
    otherWhyNotEntries.length > 0 ||
    (parseTree != null && parseTree.modules.length > 0) || // eslint-disable-line eqeqeq -- intentional nullish check
    showDecisionSpaceToggle,
  );

  // Reset showAnswer and expanded state when feedback changes (new wrong bid)
  let prevFeedback: ViewportBidFeedback | undefined;
  $effect.pre(() => {
    if (feedback !== prevFeedback) {
      showAnswer = false;
      showMoreDetails = false;
      showDecisionSpace = false;
      showScoreBreakdown = false;
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

  function isAcceptableWhyNot(call: Call): boolean {
    return acceptableBids.some((acceptable) => callsMatch(acceptable.call, call));
  }
</script>

<!-- Wrong bid — red feedback -->
<div
  class="rounded-[--radius-md] border-2 border-fb-incorrect/60 bg-fb-incorrect-bg/80 px-3 py-3 min-w-0"
  role="alert"
>
  <div class="flex items-center justify-between mb-2">
    <div class="flex items-center gap-2 min-w-0 overflow-hidden">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-fb-incorrect-emphasis shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <span class="text-fb-incorrect-text font-semibold text-[--text-detail]">Incorrect</span>
      <span class="font-mono font-bold text-[--text-detail] text-fb-incorrect-dim">{formatCall(feedback.userCall)}</span>
    </div>
    <div class="flex items-center gap-1">
      <!-- Try Again (redo) -->
      <button
        type="button"
        class="p-1.5 rounded hover:bg-fb-incorrect-hover/50 text-fb-incorrect-text hover:text-fb-incorrect-bright transition-colors cursor-pointer"
        onclick={onRetry}
        title="Try Again"
        aria-label="Try again"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
      </button>
      <!-- Show/Hide Answer (eye toggle) -->
      <button
        type="button"
        class="p-1.5 rounded hover:bg-fb-incorrect-hover/50 text-fb-incorrect-text hover:text-fb-incorrect-bright transition-colors cursor-pointer"
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
    </div>
  </div>

  {#if showAnswer && feedback.correctCall}
    <div class="min-w-0 space-y-3">

      <!-- ═══ SECTION 1: The correct answer (hero) ═══ -->
      <div class="bg-fb-incorrect-surface/50 rounded px-3 py-2.5 border border-fb-incorrect/30">
        <p class="text-[--text-annotation] text-fb-incorrect-text/60 uppercase tracking-wide mb-1">You should bid</p>
        <p class="font-mono font-bold text-[--text-heading] text-fb-incorrect-bright leading-tight">
          {formatCall(feedback.correctCall)}
        </p>
        {#if meaningLabel}
          <p class="text-[--text-detail] text-fb-incorrect-dim/80 mt-0.5">{meaningLabel}</p>
        {/if}
        {#if multiRationaleCall}
          <p class="text-[--text-label] text-note-multi-rationale/70 mt-1">
            Correct for more than one reason
            {#if multiRationaleCall.supportingMeanings.length > 0}
              — fits {multiRationaleCall.supportingMeanings.length} different meanings
            {/if}
          </p>
        {/if}
        {#if encodingNote}
          <p class="text-[--text-label] text-note-encoding/60 mt-1 italic">{encodingNote}</p>
        {/if}
        {#if fallbackNote}
          <p class="text-[--text-label] text-fb-incorrect-text/50 mt-1 italic">
            No convention applies here — pass by default
          </p>
        {/if}
        {#if ambiguityNote}
          <p class="text-[--text-annotation] text-fb-incorrect-text/40 mt-1 italic">{ambiguityNote}</p>
        {/if}
      </div>

      <!-- ═══ SECTION 2: What went wrong (key takeaway) ═══ -->
      {#if failingConditions.length > 0}
        <div class="bg-fb-incorrect-surface/30 rounded px-3 py-2 border border-accent-danger/20">
          <p class="text-[--text-annotation] text-accent-danger/80 uppercase tracking-wide mb-1.5">
            Why this doesn't work
          </p>
          <ul class="space-y-1" role="list" aria-label="Why this bid doesn't work">
            {#each failingConditions as node, ci (node.content + '-fail-' + ci)}
              <li class="flex items-start gap-1.5">
                <span class="text-accent-danger shrink-0 mt-0.5" aria-hidden="true">✗</span>
                <span class="sr-only">Failed:</span>
                <span class="text-fb-incorrect-dim break-words text-[--text-label]">{node.content}</span>
              </li>
            {/each}
          </ul>
        </div>
      {:else if teaching?.fallbackExplanation}
        <div class="bg-fb-incorrect-surface/30 rounded px-3 py-2 border border-fb-incorrect/20">
          <p class="text-fb-incorrect-dim/60 text-[--text-label] leading-tight">
            {teaching.fallbackExplanation}
          </p>
        </div>
      {/if}

      <!-- ═══ SECTION 3: Why not YOUR bid? (the user's mental question) ═══ -->
      {#if userBidWhyNot && userBidWhyNot.explanation.length > 0}
        <div class="bg-fb-incorrect-surface/30 rounded px-3 py-2 border border-fb-incorrect/20">
          <p class="text-[--text-annotation] text-fb-incorrect-text/60 uppercase tracking-wide mb-1.5">
            Why not <span class="font-mono font-semibold normal-case">{formatCall(feedback.userCall)}</span>?
          </p>
          <ul class="space-y-1" role="list" aria-label="Why your bid doesn't work">
            {#each userBidWhyNot.explanation as expNode, ei (expNode.content + '-user-' + ei)}
              <li class="flex items-start gap-1.5">
                {#if expNode.kind === "condition"}
                  <span
                    class="{expNode.passed ? 'text-accent-success' : 'text-accent-danger'} shrink-0 mt-0.5"
                    aria-hidden="true"
                  >{expNode.passed ? "✓" : "✗"}</span>
                {:else}
                  <span class="text-fb-incorrect-text/30 shrink-0 mt-0.5" aria-hidden="true">·</span>
                {/if}
                <span class="text-fb-incorrect-dim/80 text-[--text-label]">{expNode.content}</span>
              </li>
            {/each}
          </ul>
          {#if userBidWhyNot.eliminationStage}
            <p class="text-[--text-annotation] text-fb-incorrect-text/40 mt-1.5 italic">
              {formatEliminationStage(userBidWhyNot.eliminationStage)}
            </p>
          {/if}
        </div>
      {/if}

      <!-- ═══ SECTION 4: Your hand + partner context (quick reference) ═══ -->
      {#if teaching?.handSummary || hasPartnerInfo}
        <div class="rounded px-3 py-2 border border-fb-incorrect/15 space-y-2">
          {#if teaching?.handSummary}
            <div>
              <p class="text-[--text-annotation] text-fb-incorrect-text/50 uppercase tracking-wide mb-0.5">Your hand</p>
              <p class="font-mono text-[--text-detail] text-fb-incorrect-dim">{teaching.handSummary}</p>
            </div>
          {/if}
          {#if hasPartnerInfo && teaching}
            <div>
              <p class="text-[--text-annotation] text-fb-incorrect-text/50 uppercase tracking-wide mb-0.5">Partner's hand</p>
              <p class="text-[--text-label] text-fb-incorrect-dim/70">{teaching.partnerSummary}</p>
              {#if teaching.archetypes && teaching.archetypes.length > 0}
                <div class="mt-1 space-y-0.5">
                  {#each teaching.archetypes as archetype (archetype.label)}
                    <p class="text-[--text-annotation] text-fb-incorrect-text/50 font-mono">
                      {archetype.label}: {archetype.hcpRange.min}-{archetype.hcpRange.max} HCP, {archetype.shapePattern}
                    </p>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- ═══ SECTION 5: Requirements for the correct bid (passing conditions) ═══ -->
      {#if passingConditions.length > 0}
        <div class="rounded px-3 py-2 border border-fb-incorrect/15">
          <p class="text-[--text-annotation] text-fb-incorrect-text/50 uppercase tracking-wide mb-1.5">
            What the correct bid needs
          </p>
          <ul class="space-y-0.5" role="list" aria-label="Requirements for the correct bid">
            {#each passingConditions as node, ci (node.content + '-pass-' + ci)}
              <li class="flex items-start gap-1.5">
                <span class="text-accent-success/60 shrink-0 mt-0.5" aria-hidden="true">✓</span>
                <span class="sr-only">Passed:</span>
                <span class="text-fb-incorrect-dim/50 break-words text-[--text-label]">{node.content}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <!-- ═══ SECTION 6: More details (collapsed — technical deep dive) ═══ -->
      {#if hasMoreDetails}
        <div class="border-t border-fb-incorrect/15 pt-1">
          <button
            type="button"
            class="text-[--text-label] text-fb-incorrect-text/40 hover:text-fb-incorrect-dim transition-colors cursor-pointer flex items-center gap-1"
            onclick={() => { showMoreDetails = !showMoreDetails; }}
            aria-expanded={showMoreDetails}
          >
            <span class="shrink-0">{showMoreDetails ? "▾" : "▸"}</span>
            <span>More details</span>
          </button>

          {#if showMoreDetails}
            <div class="mt-2 space-y-2 ml-1">

              <!-- Convention contributions -->
              {#if showContributions}
                <div>
                  <p class="text-[--text-annotation] text-fb-incorrect-text/50 mb-1">Conventions involved:</p>
                  <div class="flex flex-wrap gap-1">
                    {#each contributions as contrib (contrib.moduleId)}
                      <span
                        class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[--text-annotation] {roleColorClasses(contrib.role)}"
                      >
                        <span class="font-medium">{formatRuleName(contrib.moduleId)}</span>
                        <span class="opacity-70">{formatModuleRole(contrib.role)}</span>
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Other bids considered -->
              {#if otherWhyNotEntries.length > 0}
                <div>
                  <p class="text-[--text-annotation] text-fb-incorrect-text/50 mb-1">Other bids:</p>
                  <div class="space-y-1">
                    {#each otherWhyNotEntries as entry, wi (wi)}
                      <div class="text-[--text-label]">
                        <button
                          type="button"
                          class="flex items-center gap-1 text-left cursor-pointer hover:text-fb-incorrect-bright transition-colors w-full flex-wrap"
                          onclick={() => toggleWhyNot(wi)}
                          aria-expanded={expandedWhyNot.has(wi)}
                          aria-label={`Toggle details for bid ${formatCall(entry.call)}`}
                        >
                          <span class="text-fb-incorrect-text/50 shrink-0">{expandedWhyNot.has(wi) ? "▾" : "▸"}</span>
                          <span class="font-mono font-bold text-fb-incorrect-dim/80">{formatCall(entry.call)}</span>
                          {#if isAcceptableWhyNot(entry.call)}
                            <span class="rounded bg-fb-acceptable-surface/70 border border-fb-acceptable/40 px-1.5 py-0.5 text-[--text-annotation] uppercase tracking-wide text-fb-acceptable-dim">
                              acceptable
                            </span>
                          {:else}
                            {@const gradeStyle = whyNotGradeClasses(entry.grade)}
                            <span class="rounded border px-1.5 py-0.5 text-[--text-annotation] uppercase tracking-wide {gradeStyle.badge}">
                              {gradeStyle.label}
                            </span>
                          {/if}
                          {#if entry.eliminationStage}
                            <span class="text-[--text-annotation] text-note-elimination/50">
                              ({formatEliminationStage(entry.eliminationStage)})
                            </span>
                          {/if}
                        </button>
                        {#if expandedWhyNot.has(wi) && entry.explanation.length > 0}
                          <ul class="ml-4 mt-0.5 space-y-0.5" role="list" aria-label="Why not this bid">
                            {#each entry.explanation as expNode, ei (expNode.content + '-' + ei)}
                              <li class="flex items-center gap-1.5 text-fb-incorrect-text/50">
                                {#if expNode.kind === "condition"}
                                  <span class={expNode.passed ? "text-accent-success" : "text-accent-danger"} aria-hidden="true">{expNode.passed ? "✓" : "✗"}</span>
                                {:else}
                                  <span class="text-fb-incorrect-text/30" aria-hidden="true">·</span>
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

              <!-- Parse tree: decision chain -->
              {#if parseTree && parseTree.modules.length > 0}
                <ParseTreePanel {parseTree} />
              {/if}

              <!-- Decision space: meanings evaluated (expandable) -->
              {#if showDecisionSpaceToggle}
                <div>
                  <button
                    type="button"
                    class="text-[--text-label] text-fb-incorrect-text/50 hover:text-fb-incorrect-dim transition-colors cursor-pointer flex items-center gap-1"
                    onclick={() => { showDecisionSpace = !showDecisionSpace; }}
                    aria-expanded={showDecisionSpace}
                  >
                    <span class="shrink-0">{showDecisionSpace ? "▾" : "▸"}</span>
                    <span>Other conventions ({eliminatedMeanings.length} ruled out)</span>
                  </button>
                  {#if showDecisionSpace}
                    <div class="mt-1 space-y-0.5 ml-3">
                      {#each eliminatedMeanings as mv (mv.meaningId)}
                        <div class="text-[--text-annotation] flex items-start gap-1.5">
                          <span class="text-fb-incorrect-emphasis/50 shrink-0" aria-hidden="true">✗</span>
                          <div>
                            <span class="text-fb-incorrect-dim/60">{mv.displayLabel}</span>
                            {#if mv.eliminationReason}
                              <span class="text-fb-incorrect-text/40"> — {mv.eliminationReason}</span>
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
        </div>
      {/if}

    </div>
  {/if}

  {#if showPracticalNote && practicalRec}
    <PracticalRecommendationNote {practicalRec} />
    {#if scoreBreakdown}
      <button
        type="button"
        class="text-[--text-annotation] text-fb-incorrect-text/40 hover:text-fb-incorrect-dim transition-colors cursor-pointer mt-1 flex items-center gap-1"
        onclick={() => { showScoreBreakdown = !showScoreBreakdown; }}
        aria-expanded={showScoreBreakdown}
      >
        <span class="shrink-0">{showScoreBreakdown ? "▾" : "▸"}</span>
        <span>Score breakdown</span>
      </button>
      {#if showScoreBreakdown}
        <div class="ml-3 mt-0.5 text-[--text-annotation] text-fb-incorrect-text/40 font-mono space-y-0.5">
          <p>Fit: {scoreBreakdown.fitScore.toFixed(1)}</p>
          <p>HCP: {scoreBreakdown.hcpScore.toFixed(1)}</p>
          <p>Convention distance: {scoreBreakdown.conventionDistance.toFixed(1)}</p>
          {#if scoreBreakdown.misunderstandingRisk > 0}
            <p>Misunderstanding risk: {scoreBreakdown.misunderstandingRisk.toFixed(1)}</p>
          {/if}
          <p class="font-semibold">Total: {scoreBreakdown.totalScore.toFixed(1)}</p>
        </div>
      {/if}
    {/if}
  {/if}

</div>
