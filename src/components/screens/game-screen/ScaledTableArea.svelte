<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    scale: number;
    origin?: string;
    children: Snippet;
  }

  let { scale, origin = "center", children }: Props = $props();
</script>

<div class="flex-1 flex items-center justify-center p-4">
  <div style="transform: scale({scale}); transform-origin: {origin};">
    {@render children()}
  </div>
</div>
