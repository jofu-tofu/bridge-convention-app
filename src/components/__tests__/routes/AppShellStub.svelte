<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();
</script>

<div data-testid="app-shell-stub">
  {@render children()}
</div>
