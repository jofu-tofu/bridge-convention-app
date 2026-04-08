<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    helper?: string;
    children: Snippet;
  }

  const { title, helper, children }: Props = $props();
</script>

<section>
  <h2 class="text-lg font-semibold text-text-primary mb-3">{title}</h2>
  {#if helper}
    <p class="text-xs text-text-muted mb-3">{helper}</p>
  {/if}
  {@render children()}
</section>
