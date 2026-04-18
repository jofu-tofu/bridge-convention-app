<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import type { Call, ServiceExplanationNode } from "../../../service";
  import type { BidFeedbackInteractiveProps } from "./types";
  import type { ViewportBidFeedback } from "../../../service";
  import { formatCall, listModules } from "../../../service";
  import { callsMatch } from "../../../service";
  import {
    whyNotGradeClasses,
    isArtificialEncoder,
    formatEncoderKind,
    formatAmbiguity,
    enrichConditionText,
  } from "./BidFeedbackPanel";
  import type { FeedbackVariant } from "./BidFeedbackPanel";
  import { variantClass } from "./BidFeedbackPanel";
  import PracticalRecommendationNote from "./PracticalRecommendationNote.svelte";
  import BidFeedbackShell from "../../shared/BidFeedbackShell.svelte";

  interface Props extends BidFeedbackInteractiveProps {
    variant?: FeedbackVariant;
  }

  let {
    feedback,
    teaching,
    onRetry,
    showPracticalNote,
    practicalRec,
    handEval,
    handSummary,
    biddingOptions,
    variant = "incorrect",
  }: Props = $props();

  let showAnswer = $state(false);
  let showMoreDetails = $state(false);
  let expandedWhyNot = new SvelteSet<number>();
  const acceptableBids = $derived(teaching?.acceptableBids ?? []);

  // Map moduleId → displayName so whyNot rows can identify which convention
  // each eliminated meaning came from (e.g., Natural 3NT vs Jacoby 3NT).
  const moduleDisplayNames = $derived.by(() => {
    const map = new Map<string, string>();
    for (const m of listModules()) map.set(m.moduleId, m.displayName);
    return map;
  });
  function moduleDisplayName(moduleId: string): string {
    return moduleDisplayNames.get(moduleId) ?? moduleId;
  }

  // Meaning display label from the live meaning view
  const liveMeaning = $derived(
    teaching?.meaningViews?.find((v) => v.status === "live"),
  );
  const meaningLabel = $derived(
    liveMeaning?.displayLabel ?? feedback.correctBidLabel?.name ?? "",
  );
  const correctCallLabel = $derived(
    feedback.correctCall ? formatCall(feedback.correctCall) : "",
  );
  const visibleMeaningLabel = $derived.by(() => {
    if (!meaningLabel || !correctCallLabel) return meaningLabel;
    if (
      meaningLabel === correctCallLabel ||
      meaningLabel === `Bid ${correctCallLabel}`
    ) {
      return "";
    }
    return meaningLabel;
  });

  // Conditions from primary explanation (kind="condition" nodes)
  const conditionNodes = $derived(
    teaching?.primaryExplanation?.filter((n) => n.kind === "condition") ?? [],
  );

  // Split conditions: failing first (the key takeaway), then passing
  const failingConditions = $derived(conditionNodes.filter((n) => !n.passed));
  const passingConditions = $derived(conditionNodes.filter((n) => n.passed));

  // WhyNot entries — alternative bids with explanations
  const whyNotEntries = $derived(teaching?.whyNot ?? []);

  // The user's specific bid in whyNot (surface this prominently)
  const userBidWhyNot = $derived(
    whyNotEntries.find((e) => callsMatch(e.call, feedback.userCall)),
  );

  // Remaining whyNot entries: only near-misses and acceptable alternatives
  const filteredOtherWhyNot = $derived(
    whyNotEntries
      .filter((e) => !callsMatch(e.call, feedback.userCall))
      .filter((e) => e.grade === "near-miss" || isAcceptableWhyNot(e.call)),
  );

  // Multi-rationale detection: a call correct for more than one distinct reason
  const multiRationaleCall = $derived(
    teaching?.callViews?.find(
      (cv) =>
        cv.status === "truth" &&
        cv.projectionKind === "multi-rationale-same-call",
    ) ?? null,
  );

  // Partner hand space summary
  const hasPartnerInfo = $derived(teaching?.partnerSummary !== null && teaching?.partnerSummary !== undefined);

  // Encoding explanation — show when the meaning was encoded via an artificial mechanism
  const encodingNote = $derived(
    teaching?.encoderKind && isArtificialEncoder(teaching.encoderKind)
      ? formatEncoderKind(teaching.encoderKind)
      : null,
  );

  // Decision metadata — ambiguity and grading type
  const ambiguityNote = $derived(
    teaching?.ambiguityScore !== null && teaching?.ambiguityScore !== undefined
      ? formatAmbiguity(teaching.ambiguityScore)
      : null,
  );

  // Practical score breakdown
  const scoreBreakdown = $derived(teaching?.practicalScoreBreakdown ?? null);
  let showScoreBreakdown = $state(false);

  // Fallback reached — no convention surface matched
  const fallbackNote = $derived(teaching?.fallbackReached === true);

  // Look up what the user's bid means in the convention system
  const userBidOption = $derived(
    biddingOptions.find((o) => callsMatch(o.call, feedback.userCall)),
  );
  const userBidIsPass = $derived(feedback.userCall.type === "pass");

  // Filtered explanation nodes from the user's whyNot entry
  const userWhyNotNodes = $derived(
    (userBidWhyNot?.explanation ?? []).filter(
      (n) =>
        n.kind !== "text" || !n.content.startsWith("Your hand doesn't meet"),
    ),
  );

  // Whether to show the user's bid meaning (has a teaching label in biddingOptions)
  const userBidMeaningText = $derived(
    userBidOption?.teachingLabel
      ? `${formatCall(feedback.userCall)} means: ${userBidOption.teachingLabel.name}${userBidOption.teachingLabel.summary ? ` — ${userBidOption.teachingLabel.summary}` : ""}`
      : null,
  );

  // Has any "more details" content worth showing
  const hasMoreDetails = $derived(
    filteredOtherWhyNot.length > 0 || !!handSummary || hasPartnerInfo,
  );

  // Reset showAnswer and expanded state when feedback changes (new wrong bid)
  let prevFeedback: ViewportBidFeedback | undefined;
  $effect.pre(() => {
    if (feedback !== prevFeedback) {
      showAnswer = false;
      showMoreDetails = false;
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
    return acceptableBids.some((acceptable) =>
      callsMatch(acceptable.call, call),
    );
  }

  /** Enrich a condition node's text with actual hand values when available. */
  function enrichCondition(node: ServiceExplanationNode): string {
    if (!handEval) return node.content;
    return enrichConditionText(node, handEval);
  }

  // Shorthand for variant class lookups
  function vc(key: string): string {
    return variantClass(variant, key);
  }
</script>

<!-- Wrong/near-miss bid feedback -->
<BidFeedbackShell {variant}>
  <div class="mb-2 flex items-center justify-between">
    <div class="flex min-w-0 items-center gap-2 overflow-hidden">
      {#if variant === "near-miss"}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="{vc('emphasis')} shrink-0"
          aria-hidden="true"
          ><path
            d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          /><line x1="12" y1="9" x2="12" y2="13" /><line
            x1="12"
            y1="17"
            x2="12.01"
            y2="17"
          /></svg
        >
      {:else}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="{vc('emphasis')} shrink-0"
          aria-hidden="true"
          ><circle cx="12" cy="12" r="10" /><line
            x1="15"
            y1="9"
            x2="9"
            y2="15"
          /><line x1="9" y1="9" x2="15" y2="15" /></svg
        >
      {/if}
      <span class="{vc('text')} font-semibold text-[--text-detail]"
        >{variant === "near-miss" ? "Close" : "Incorrect"}</span
      >
      <span class="font-mono font-bold text-[--text-detail] {vc('dim')}"
        >{formatCall(feedback.userCall)}</span
      >
    </div>
    <!-- Try Again (redo) -->
    <button
      type="button"
      class="rounded p-1.5 {vc('hover:bg/50')} {vc('text')} {vc(
        'hover:bright',
      )} cursor-pointer transition-colors"
      onclick={onRetry}
      title="Try Again"
      aria-label="Try again"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><polyline points="1 4 1 10 7 10" /><path
          d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"
        /></svg
      >
    </button>
  </div>

  {#if !showAnswer}
    <!-- Show Answer — prominent labeled button -->
    <button
      type="button"
      class="flex w-full items-center justify-center gap-1.5 rounded border {vc(
        'border/40',
      )} {vc('surface/40')} px-3 py-1.5 text-[--text-label] {vc('text')} {vc(
        'hover:bg/40',
      )} {vc('hover:bright')} mb-2 cursor-pointer transition-colors"
      onclick={() => {
        showAnswer = true;
      }}
      aria-label="Show answer"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="shrink-0"
        aria-hidden="true"
        ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle
          cx="12"
          cy="12"
          r="3"
        /></svg
      >
      <span>Show Answer</span>
    </button>
  {/if}

  {#if showAnswer && feedback.correctCall}
    <div class="min-w-0 space-y-3">
      <!-- ═══ SECTION 1: The correct answer (hero) ═══ -->
      <div
        class="{vc('surface/50')} rounded border px-3 py-2.5 {vc('border/30')}"
      >
        <div class="mb-1 flex items-center justify-between">
          <p
            class="text-[--text-annotation] {vc(
              'text/60',
            )} tracking-wide uppercase"
          >
            Correct bid
          </p>
          <button
            type="button"
            class="text-[--text-annotation] {vc('text/40')} {vc(
              'hover:dim',
            )} flex cursor-pointer items-center gap-1 transition-colors"
            onclick={() => {
              showAnswer = false;
            }}
            aria-label="Hide answer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="shrink-0"
              aria-hidden="true"
              ><path
                d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
              /><line x1="1" y1="1" x2="23" y2="23" /></svg
            >
            <span>Hide</span>
          </button>
        </div>
        <p
          class="font-mono font-bold text-[--text-heading] {vc(
            'bright',
          )} leading-tight"
        >
          {formatCall(feedback.correctCall)}{#if visibleMeaningLabel}
            <span
              class="font-sans font-normal text-[--text-detail] {vc('dim/80')}"
              >— {visibleMeaningLabel}</span
            >{/if}
        </p>
        {#if feedback.correctBidLabel?.summary}
          <p class="text-[--text-label] {vc('dim/70')} mt-1 leading-snug">
            {feedback.correctBidLabel.summary}
          </p>
        {/if}
        {#if multiRationaleCall}
          <p class="text-note-multi-rationale/70 mt-1 text-[--text-label]">
            Correct for more than one reason
            {#if multiRationaleCall.supportingMeanings.length > 0}
              — fits {multiRationaleCall.supportingMeanings.length} different meanings
            {/if}
          </p>
        {/if}
        {#if encodingNote}
          <p class="text-note-encoding/60 mt-1 text-[--text-label] italic">
            {encodingNote}
          </p>
        {/if}
        {#if fallbackNote}
          <p class="text-[--text-label] {vc('text/50')} mt-1 italic">
            No convention applies here — pass by default
          </p>
        {/if}
        {#if ambiguityNote}
          <p class="text-[--text-annotation] {vc('text/40')} mt-1 italic">
            {ambiguityNote}
          </p>
        {/if}
        {#if passingConditions.length > 0}
          <ul
            class="mt-2 space-y-0.5 border-t {vc('border/20')} pt-2"
            role="list"
            aria-label="Requirements for the correct bid"
          >
            {#each passingConditions as node, ci (node.content + "-pass-" + ci)}
              <li class="flex items-start gap-1.5">
                <span
                  class="text-accent-success/60 mt-0.5 shrink-0"
                  aria-hidden="true">✓</span
                >
                <span class="sr-only">Passed:</span>
                <span class="{vc('dim/50')} break-words text-[--text-label]"
                  >{enrichCondition(node)}</span
                >
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <!-- ═══ SECTION 2: Why not YOUR bid? ═══ -->
      {#if userWhyNotNodes.length > 0 || failingConditions.length > 0 || userBidOption?.teachingLabel || !userBidWhyNot}
        <div
          class="{vc('surface/30')} rounded border px-3 py-2 {vc('border/20')}"
        >
          <p
            class="text-[--text-annotation] {vc(
              'text/60',
            )} mb-1.5 tracking-wide uppercase"
          >
            Why not <span class="font-mono font-semibold normal-case"
              >{formatCall(feedback.userCall)}</span
            >?
          </p>

          <!-- Case 1: whyNot entry or failing conditions — show meaning + conditions -->
          {#if userWhyNotNodes.length > 0 || failingConditions.length > 0}
            {#if userBidMeaningText}
              <p class="{vc('dim/70')} mb-1.5 leading-snug text-[--text-label]">
                {userBidMeaningText}
              </p>
            {/if}
            <ul
              class="space-y-1"
              role="list"
              aria-label="Why your bid doesn't work"
            >
              {#each failingConditions as node, ci (node.content + "-fail-" + ci)}
                <li class="flex items-start gap-1.5">
                  <span
                    class="text-accent-danger mt-0.5 shrink-0"
                    aria-hidden="true">✗</span
                  >
                  <span class="sr-only">Failed:</span>
                  <span class="{vc('dim')} break-words text-[--text-label]"
                    >{enrichCondition(node)}</span
                  >
                </li>
              {/each}
              {#each userWhyNotNodes as expNode, ei (expNode.content + "-user-" + ei)}
                <li class="flex items-start gap-1.5">
                  {#if expNode.kind === "condition"}
                    <span
                      class="{expNode.passed
                        ? 'text-accent-success'
                        : 'text-accent-danger'} mt-0.5 shrink-0"
                      aria-hidden="true">{expNode.passed ? "✓" : "✗"}</span
                    >
                  {:else}
                    <span
                      class="{vc('text/30')} mt-0.5 shrink-0"
                      aria-hidden="true">·</span
                    >
                  {/if}
                  <span class="{vc('dim/80')} text-[--text-label]"
                    >{enrichCondition(expNode)}</span
                  >
                </li>
              {/each}
            </ul>

            <!-- Case 2: No whyNot, but biddingOptions has a meaning for the user's bid -->
          {:else if userBidMeaningText}
            <p class="{vc('dim/70')} leading-snug text-[--text-label]">
              {userBidMeaningText}
            </p>

            <!-- Case 3: Pass with no convention meaning -->
          {:else if userBidIsPass}
            <p class="{vc('dim/70')} leading-snug text-[--text-label]">
              Pass signals no convention response
            </p>

            <!-- Case 4: Non-pass bid with no convention meaning and no whyNot -->
          {:else}
            <p class="{vc('dim/70')} leading-snug text-[--text-label]">
              {formatCall(feedback.userCall)} has no convention meaning in this auction
            </p>
          {/if}
        </div>
      {/if}

      <!-- ═══ SECTION 3: More details (collapsed — hand context + near-miss bids) ═══ -->
      {#if hasMoreDetails}
        <div class="border-t {vc('border/15')} pt-1">
          <button
            type="button"
            class="text-[--text-label] {vc('text/40')} {vc(
              'hover:dim',
            )} flex cursor-pointer items-center gap-1 transition-colors"
            onclick={() => {
              showMoreDetails = !showMoreDetails;
            }}
            aria-expanded={showMoreDetails}
          >
            <span class="shrink-0">{showMoreDetails ? "▾" : "▸"}</span>
            <span>More details</span>
          </button>

          {#if showMoreDetails}
            <div class="mt-2 ml-1 space-y-2">
              <!-- Hand + partner context -->
              {#if handSummary || hasPartnerInfo}
                <div
                  class="rounded border px-3 py-2 {vc('border/15')} space-y-2"
                >
                  {#if handSummary}
                    <div>
                      <p
                        class="text-[--text-annotation] {vc(
                          'text/50',
                        )} mb-0.5 tracking-wide uppercase"
                      >
                        Your hand
                      </p>
                      <!-- teaching.handSummary shows hand-space bounds (e.g. "0-40 HCP, any"), not actual hand — use viewport's handSummary instead -->
                      <p class="font-mono text-[--text-detail] {vc('dim')}">
                        {handSummary}
                      </p>
                    </div>
                  {/if}
                  {#if hasPartnerInfo && teaching}
                    <div>
                      <p
                        class="text-[--text-annotation] {vc(
                          'text/50',
                        )} mb-0.5 tracking-wide uppercase"
                      >
                        Partner's hand
                      </p>
                      <p class="text-[--text-label] {vc('dim/70')}">
                        {teaching.partnerSummary}
                      </p>
                      {#if teaching.archetypes && teaching.archetypes.length > 0}
                        <div class="mt-1 space-y-0.5">
                          {#each teaching.archetypes as archetype (archetype.label)}
                            <p
                              class="text-[--text-annotation] {vc(
                                'text/50',
                              )} font-mono"
                            >
                              {archetype.label}: {archetype.hcpRange
                                .min}-{archetype.hcpRange.max} HCP, {archetype.shapePattern}
                            </p>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}

              <!-- Other bids (near-misses and acceptable only) -->
              {#if filteredOtherWhyNot.length > 0}
                <div>
                  <p class="text-[--text-annotation] {vc('text/50')} mb-1">
                    Other bids:
                  </p>
                  <div class="space-y-1">
                    {#each filteredOtherWhyNot as entry, wi (wi)}
                      {@const gradeStyle = whyNotGradeClasses(entry.grade)}
                      {@const callAlsoAcceptable = isAcceptableWhyNot(entry.call)}
                      <div class="text-[--text-label]">
                        <button
                          type="button"
                          class="flex cursor-pointer items-center gap-1 text-left {vc(
                            'hover:bright',
                          )} w-full flex-wrap transition-colors"
                          onclick={() => toggleWhyNot(wi)}
                          aria-expanded={expandedWhyNot.has(wi)}
                          aria-label={`Toggle details for bid ${formatCall(entry.call)}`}
                        >
                          <span class="{vc('text/50')} shrink-0"
                            >{expandedWhyNot.has(wi) ? "▾" : "▸"}</span
                          >
                          <span class="font-mono font-bold {vc('dim/80')}"
                            >{formatCall(entry.call)}</span
                          >
                          <span
                            class="rounded border px-1.5 py-0.5 tracking-wide text-[--text-annotation] uppercase {gradeStyle.badge}"
                          >
                            {gradeStyle.label}
                          </span>
                          {#if entry.meaningLabel}
                            <span class="{vc('dim/70')} text-[--text-label]"
                              >as {entry.meaningLabel}</span
                            >
                          {/if}
                          {#if entry.moduleId}
                            <span
                              class="{vc(
                                'text/40',
                              )} text-[--text-annotation] italic"
                              >({moduleDisplayName(entry.moduleId)})</span
                            >
                          {/if}
                          {#if callAlsoAcceptable}
                            <span
                              class="bg-fb-acceptable-surface/70 border-fb-acceptable/40 text-fb-acceptable-dim rounded border px-1.5 py-0.5 tracking-wide text-[--text-annotation] uppercase"
                              title="This call is valid via another meaning"
                            >
                              other meaning OK
                            </span>
                          {/if}
                        </button>
                        {#if expandedWhyNot.has(wi) && entry.explanation.length > 0}
                          {@const otherExplanationNodes =
                            entry.explanation.filter(
                              (n) =>
                                n.kind !== "text" ||
                                !n.content.startsWith("Your hand doesn't meet"),
                            )}
                          <ul
                            class="mt-0.5 ml-4 space-y-0.5"
                            role="list"
                            aria-label="Why not this bid"
                          >
                            {#each otherExplanationNodes as expNode, ei (expNode.content + "-" + ei)}
                              <li
                                class="flex items-center gap-1.5 {vc(
                                  'text/50',
                                )}"
                              >
                                {#if expNode.kind === "condition"}
                                  <span
                                    class={expNode.passed
                                      ? "text-accent-success"
                                      : "text-accent-danger"}
                                    aria-hidden="true"
                                    >{expNode.passed ? "✓" : "✗"}</span
                                  >
                                {:else}
                                  <span class={vc("text/30")} aria-hidden="true"
                                    >·</span
                                  >
                                {/if}
                                <span>{enrichCondition(expNode)}</span>
                              </li>
                            {/each}
                          </ul>
                        {/if}
                      </div>
                    {/each}
                  </div>
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
        class="text-[--text-annotation] {vc('text/40')} {vc(
          'hover:dim',
        )} mt-1 flex cursor-pointer items-center gap-1 transition-colors"
        onclick={() => {
          showScoreBreakdown = !showScoreBreakdown;
        }}
        aria-expanded={showScoreBreakdown}
      >
        <span class="shrink-0">{showScoreBreakdown ? "▾" : "▸"}</span>
        <span>Score breakdown</span>
      </button>
      {#if showScoreBreakdown}
        <div
          class="mt-0.5 ml-3 text-[--text-annotation] {vc(
            'text/40',
          )} space-y-0.5 font-mono"
        >
          <p>Fit: {scoreBreakdown.fitScore.toFixed(1)}</p>
          <p>HCP: {scoreBreakdown.hcpScore.toFixed(1)}</p>
          <p>
            Convention distance: {scoreBreakdown.conventionDistance.toFixed(1)}
          </p>
          {#if scoreBreakdown.misunderstandingRisk > 0}
            <p>
              Misunderstanding risk: {scoreBreakdown.misunderstandingRisk.toFixed(
                1,
              )}
            </p>
          {/if}
          <p class="font-semibold">
            Total: {scoreBreakdown.totalScore.toFixed(1)}
          </p>
        </div>
      {/if}
    {/if}
  {/if}
</BidFeedbackShell>
