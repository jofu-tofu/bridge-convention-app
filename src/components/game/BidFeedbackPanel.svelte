<script lang="ts">
  import type { BidFeedback } from "../../stores/game.svelte";
  import { formatCall } from "../../lib/format";
  import Button from "../shared/Button.svelte";

  interface Props {
    feedback: BidFeedback;
    onContinue: () => void;
    onSkipToReview: () => void;
  }

  let { feedback, onContinue, onSkipToReview }: Props = $props();

  let showAnswer = $state(false);

  // Reset showAnswer when feedback changes (new wrong bid)
  let prevFeedback = $state(feedback);
  $effect(() => {
    if (feedback !== prevFeedback) {
      showAnswer = false;
      prevFeedback = feedback;
    }
  });
</script>

{#if feedback.isCorrect}
  <!-- Correct bid — green flash -->
  <div
    class="rounded-lg border-2 border-green-500/60 bg-green-950/80 px-4 py-3 text-center"
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
    class="rounded-lg border-2 border-red-500/60 bg-red-950/80 px-4 py-3"
    role="alert"
  >
    <div class="flex items-center gap-2 mb-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-red-400"
        aria-hidden="true"
        ><circle cx="12" cy="12" r="10" /><line
          x1="15"
          y1="9"
          x2="9"
          y2="15"
        /><line x1="9" y1="9" x2="15" y2="15" /></svg
      >
      <span class="text-red-300 font-semibold text-sm">Incorrect Bid</span>
    </div>

    <p class="text-red-200/80 text-xs mb-3">
      You bid <span class="font-mono font-bold text-red-200"
        >{formatCall(feedback.userCall)}</span
      >
    </p>

    {#if showAnswer && feedback.expectedResult}
      <div
        class="bg-red-900/50 rounded px-3 py-2 mb-3 border border-red-500/30"
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
                <li class="text-xs">
                  <span class="text-red-200/70">{cond.description}</span>
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
                          <span class="text-red-200/70">{sub.description}</span>
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
                  <span class="text-red-200/70">{cond.description}</span>
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

    <div class="flex flex-col gap-2">
      {#if !showAnswer}
        <Button
          variant="secondary"
          onclick={() => {
            showAnswer = true;
          }}
        >
          Show Answer
        </Button>
      {/if}
      <Button variant="primary" onclick={onContinue}>Continue</Button>
      <Button variant="ghost" onclick={onSkipToReview}>Skip to Review</Button>
    </div>
  </div>
{/if}
