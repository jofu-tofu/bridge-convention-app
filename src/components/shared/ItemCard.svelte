<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    onclick?: () => void;
    selected?: boolean;
    interactive?: boolean;
    testId?: string;
    class?: string;
    children: Snippet;
  }

  const {
    onclick,
    selected = false,
    interactive = true,
    testId,
    class: className = "",
    children,
  }: Props = $props();
</script>

<!-- When onclick is provided, render as button for accessibility -->
{#if onclick}
  <button
    type="button"
    class="w-full text-left bg-bg-card border rounded-[--radius-lg] p-4 transition-all
      {selected
        ? 'border-accent-primary ring-1 ring-accent-primary'
        : interactive
          ? 'border-border-subtle hover:border-border-default hover:shadow-md'
          : 'border-border-subtle'}
      {interactive ? 'cursor-pointer' : ''}
      {className}"
    {onclick}
    data-testid={testId}
  >
    {@render children()}
  </button>
{:else}
  <div
    class="bg-bg-card border rounded-[--radius-lg] p-4 transition-all
      {selected
        ? 'border-accent-primary ring-1 ring-accent-primary'
        : interactive
          ? 'border-border-subtle hover:border-border-default hover:shadow-md'
          : 'border-border-subtle'}
      {className}"
    data-testid={testId}
  >
    {@render children()}
  </div>
{/if}
