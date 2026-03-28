<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    level?: "h2" | "h3";
    class?: string;
    ariaLive?: "off" | "assertive" | "polite";
    children: Snippet;
  }

  const { level = "h2", class: className = "", ariaLive, children }: Props = $props();

  const baseClass = "text-[--text-label] font-medium text-text-muted uppercase tracking-wider";
</script>

<!-- Svelte 5 does not support dynamic element tags, so we branch explicitly -->
{#if level === "h3"}
  <h3 class="{baseClass} {className}" aria-live={ariaLive}>{@render children()}</h3>
{:else}
  <h2 class="{baseClass} {className}" aria-live={ariaLive}>{@render children()}</h2>
{/if}
