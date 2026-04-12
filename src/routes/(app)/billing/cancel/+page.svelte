<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import CardSurface from "../../../../components/shared/CardSurface.svelte";

  onMount(() => {
    const timeoutId = window.setTimeout(() => {
      void goto("/practice");
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  });
</script>

<svelte:head>
  <title>BridgeLab — Subscription Not Started</title>
</svelte:head>

<main class="flex h-full items-center justify-center p-4">
  <CardSurface as="section" class="w-full max-w-md p-6 text-center">
    <h1 class="text-xl font-semibold text-text-primary">Subscription not started — no charge was made.</h1>
    <p class="mt-2 text-sm text-text-secondary">
      Returning you to practice in a moment.
    </p>
    <a
      class="mt-4 inline-flex min-h-[--size-touch-target] items-center justify-center rounded-[--radius-md] border border-border-default px-4 py-2 text-[--text-body] font-medium text-text-primary transition-colors hover:bg-bg-hover"
      href="/practice"
    >
      Back to practice
    </a>
  </CardSurface>
</main>
