<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "back" | "inline" | "card";

  interface Props {
    href: string;
    variant?: Variant;
    class?: string;
    testId?: string;
    children: Snippet;
  }

  const {
    href,
    variant = "inline",
    class: className = "",
    testId,
    children,
  }: Props = $props();

  const backClass =
    "inline-flex items-center gap-1 text-sm text-text-secondary hover:text-accent-primary no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary rounded-[--radius-sm]";

  const inlineClass =
    "text-accent-primary hover:text-accent-primary-hover underline-offset-2 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary rounded-[--radius-sm]";

  const cardClass =
    "block bg-bg-card border border-border-subtle rounded-[--radius-lg] p-4 no-underline transition-all hover:border-border-default hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary";
</script>

{#if variant === "back"}
  <a {href} class="{backClass} {className}" data-testid={testId}>
    <span aria-hidden="true">←</span>
    {@render children()}
  </a>
{:else if variant === "card"}
  <a {href} class="{cardClass} {className}" data-testid={testId}>
    {@render children()}
  </a>
{:else}
  <a {href} class="{inlineClass} {className}" data-testid={testId}>
    {@render children()}
  </a>
{/if}
