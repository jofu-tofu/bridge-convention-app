<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import CardSurface from "../../../../components/shared/CardSurface.svelte";
  import { delay, SubscriptionTier } from "../../../../service";
  import { getAuthStore } from "../../../../stores/context";

  const auth = getAuthStore();

  let isPending = $state(true);

  onMount(() => {
    let cancelled = false;

    async function waitForActivation() {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await delay(2000);
        if (cancelled) return;

        const user = await auth.refresh();
        if (cancelled) return;

        if (user?.subscription_tier === SubscriptionTier.Paid) {
          await goto("/practice");
          return;
        }
      }

      if (!cancelled) {
        isPending = false;
      }
    }

    void waitForActivation();

    return () => {
      cancelled = true;
    };
  });
</script>

<svelte:head>
  <title>BridgeLab — Activating Subscription</title>
</svelte:head>

<main class="flex h-full items-center justify-center p-4">
  <CardSurface as="section" class="w-full max-w-md p-6 text-center">
    <h1 class="text-xl font-semibold text-text-primary">Activating your subscription…</h1>
    <p class="mt-2 text-sm text-text-secondary">
      We&apos;re waiting for billing confirmation and will send you back to practice automatically.
    </p>

    {#if !isPending}
      <p class="mt-4 text-sm text-text-secondary">
        It&apos;s taking a moment — your subscription will be active shortly.
      </p>
      <a
        class="mt-4 inline-flex min-h-[--size-touch-target] items-center justify-center rounded-[--radius-md] border border-border-default px-4 py-2 text-[--text-body] font-medium text-text-primary transition-colors hover:bg-bg-hover"
        href="/practice"
      >
        Back to practice
      </a>
    {/if}
  </CardSurface>
</main>
