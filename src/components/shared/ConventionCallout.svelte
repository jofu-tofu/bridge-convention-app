<script lang="ts">
  import type { ConditionDetail } from "../../shared/types";

  interface Props {
    ruleName: string;
    explanation: string;
    conditions?: readonly ConditionDetail[];
  }

  let { ruleName, explanation, conditions }: Props = $props();
</script>

<span class="inline-flex items-center gap-2">
  <span class="inline-block px-2 py-0.5 rounded-[--radius-sm] text-xs font-semibold bg-accent-primary-subtle text-accent-primary">
    {ruleName}
  </span>
  {#if conditions && conditions.length > 0}
    <ul class="inline-flex items-center gap-2 text-text-secondary text-sm list-none p-0 m-0" role="list" aria-label="Bid conditions">
      {#each conditions as cond (cond.name)}
        {#if cond.children}
          <li class="text-xs">
            <span class="text-text-muted">{cond.description}</span>
            <ul class="inline-flex items-center gap-1 list-none p-0 m-0 ml-1" role="list" aria-label="Condition branches">
              {#each cond.children as branch (branch.name)}
                <li class="{branch.isBestBranch ? '' : 'opacity-40'}">
                  <span class={branch.passed ? 'text-accent-success' : 'text-accent-danger'} aria-hidden="true">{branch.passed ? '✓' : '✗'}</span>
                  <span class="sr-only">{branch.passed ? 'Passed' : 'Failed'}</span>
                </li>
              {/each}
            </ul>
          </li>
        {:else}
          <li class="inline-flex items-center gap-1">
            <span class={cond.passed ? 'text-accent-success' : 'text-accent-danger'} aria-hidden="true">{cond.passed ? '✓' : '✗'}</span>
            <span class="sr-only">{cond.passed ? 'Passed:' : 'Failed:'}</span>
            <span class="text-text-muted text-xs">{cond.description}</span>
          </li>
        {/if}
      {/each}
    </ul>
  {:else}
    <span class="text-text-secondary text-sm">{explanation}</span>
  {/if}
</span>
