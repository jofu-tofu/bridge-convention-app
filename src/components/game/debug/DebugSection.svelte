<!-- Reusable collapsible section for the debug drawer.
     Provides consistent styling: compact header, optional count badge,
     optional inline preview text, and nested <details> support. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    count?: number | null;
    badge?: string | null;
    badgeColor?: string;
    preview?: string | null;
    open?: boolean;
    nested?: boolean;
    children: Snippet;
  }

  let {
    title,
    count = null,
    badge = null,
    badgeColor = "bg-gray-700 text-gray-300",
    preview = null,
    open = false,
    nested = false,
    children,
  }: Props = $props();
</script>

<details {open}>
  <summary
    class="cursor-pointer select-none py-0.5 flex items-center gap-1.5 {nested
      ? 'text-xs text-text-muted font-medium'
      : 'text-xs text-text-primary font-semibold'}"
  >
    <span class="shrink-0">{title}</span>
    {#if count !== null && count !== undefined}
      <span class="text-[10px] px-1 rounded bg-gray-700/60 text-text-muted font-normal tabular-nums">{count}</span>
    {/if}
    {#if badge}
      <span class="text-[10px] px-1 rounded font-normal {badgeColor}">{badge}</span>
    {/if}
    {#if preview}
      <span class="text-[10px] text-text-muted font-normal truncate">{preview}</span>
    {/if}
  </summary>
  <div class="{nested ? 'pl-2 py-0.5' : 'pl-2 py-0.5'}">
    {@render children()}
  </div>
</details>
