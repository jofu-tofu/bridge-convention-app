<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    as?: "div" | "section";
    radius?: "md" | "lg";
    class?: string;
    testId?: string;
    children: Snippet;
  }

  const {
    as: element = "div",
    radius = "lg",
    class: className = "",
    testId,
    children,
  }: Props = $props();

  const radiusClasses: Record<string, string> = {
    md: "rounded-[--radius-md]",
    lg: "rounded-[--radius-lg]",
  };
</script>

{#if element === "section"}
  <section
    class="bg-bg-card border border-border-subtle {radiusClasses[radius]} transition-all {className}"
    data-testid={testId}
  >
    {@render children()}
  </section>
{:else}
  <div
    class="bg-bg-card border border-border-subtle {radiusClasses[radius]} transition-all {className}"
    data-testid={testId}
  >
    {@render children()}
  </div>
{/if}
