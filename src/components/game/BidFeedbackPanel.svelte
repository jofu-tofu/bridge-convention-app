<script lang="ts">
  import type { BidFeedback } from "../../stores/game.svelte";
  import { formatCall } from "../../lib/format";

  interface Props {
    feedback: BidFeedback;
    onContinue: () => void;
    onSkipToReview: () => void;
    onRetry?: () => void;
  }

  let { feedback, onContinue, onSkipToReview, onRetry }: Props = $props();

  let showAnswer = $state(false);

  // Reset showAnswer when feedback changes (new wrong bid)
  let prevFeedback: BidFeedback | undefined;
  $effect.pre(() => {
    if (feedback !== prevFeedback) {
      showAnswer = false;
    }
    prevFeedback = feedback;
  });
</script>

{#if feedback.isCorrect}
  <!-- Correct bid — green flash -->
  <div
    class="rounded-[--radius-md] border-2 border-green-500/60 bg-green-950/80 px-3 py-3 text-center min-w-0"
    role="alert"
  >
    <p class="text-green-300 font-semibold text-sm">Correct!</p>
    <p class="text-green-400 font-mono text-lg mt-1">
      {formatCall(feedback.userCall)}
    </p>
    {#if feedback.expectedResult?.ruleName}
      <p class="text-green-300/70 text-xs mt-1">
        {feedback.expectedResult.ruleName}
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
        class="bg-red-900/50 rounded px-3 py-2 mb-3 border border-red-500/30 min-w-0"
      >
        <p class="text-xs text-red-300/70 mb-1">Correct bid:</p>
        <p class="font-mono font-bold text-base text-red-100">
          {formatCall(feedback.expectedResult.call)}
        </p>
        {#if feedback.expectedResult.ruleName}
          <p class="text-red-300/60 text-xs mt-1">
            {feedback.expectedResult.ruleName}
          </p>
        {/if}
        {#if feedback.expectedResult.conditions}
          <ul class="mt-2 space-y-1" role="list" aria-label="Bid conditions">
            {#each feedback.expectedResult.conditions as cond (cond.name)}
              {#if cond.children}
                <li class="text-xs min-w-0">
                  <span class="text-red-200/70 break-words">{cond.description}</span>
                  {#each cond.children as branch (branch.name)}
                    <ul
                      class="ml-3 mt-1 {branch.isBestBranch
                        ? ''
                        : 'opacity-40'}"
                      role="list"
                      aria-label={branch.isBestBranch
                        ? "Best matching path"
                        : "Alternative path"}
                    >
                      {#each branch.children ?? [] as sub (sub.name)}
                        <li class="flex items-center gap-1.5">
                          <span
                            class={sub.passed
                              ? "text-accent-success"
                              : "text-accent-danger"}
                            aria-hidden="true">{sub.passed ? "✓" : "✗"}</span
                          >
                          <span class="sr-only"
                            >{sub.passed ? "Passed:" : "Failed:"}</span
                          >
                          <span class="text-red-200/70 break-words">{sub.description}</span>
                        </li>
                      {/each}
                    </ul>
                  {/each}
                </li>
              {:else}
                <li class="flex items-center gap-1.5">
                  <span
                    class={cond.passed
                      ? "text-accent-success"
                      : "text-accent-danger"}
                    aria-hidden="true">{cond.passed ? "✓" : "✗"}</span
                  >
                  <span class="sr-only"
                    >{cond.passed ? "Passed:" : "Failed:"}</span
                  >
                  <span class="text-red-200/70 break-words">{cond.description}</span>
                </li>
              {/if}
            {/each}
          </ul>
        {:else if feedback.expectedResult.explanation}
          <p class="text-red-200/50 text-xs mt-1 leading-tight">
            {feedback.expectedResult.explanation}
          </p>
        {/if}
      </div>
    {/if}

  </div>
{/if}
