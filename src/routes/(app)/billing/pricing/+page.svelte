<script lang="ts">
  import { goto } from "$app/navigation";
  import AppScreen from "../../../../components/shared/AppScreen.svelte";
  import AuthModal from "../../../../components/shared/AuthModal.svelte";
  import CardSurface from "../../../../components/shared/CardSurface.svelte";
  import { SubscriptionTier } from "../../../../service";
  import { getAuthStore, getDataPort } from "../../../../stores/context";

  const MONTHLY_PRICE_DISPLAY = "$5.99 / month";

  const auth = getAuthStore();
  const dataPort = getDataPort();

  let authModal = $state<ReturnType<typeof AuthModal>>();
  let isStartingCheckout = $state(false);
  let errorMessage = $state<string | null>(null);

  $effect(() => {
    if (auth.user?.subscription_tier === SubscriptionTier.Paid) {
      void goto("/");
    }
  });

  async function handleSubscribe() {
    errorMessage = null;
    isStartingCheckout = true;
    try {
      const { url } = await dataPort.startCheckout("monthly");
      if (!url) {
        // eslint-disable-next-line no-console -- explicit dev-mode no-op for local billing-disabled flows
        console.warn("Billing disabled in dev");
        return;
      }
      window.location.href = url;
    } catch {
      errorMessage = "Unable to start checkout. Please try again.";
    } finally {
      isStartingCheckout = false;
    }
  }

  function handlePrimaryClick() {
    // Two-tap flow by design: logged-out users sign in first, then tap Subscribe
    // again. Do not chain an auto-subscribe after the modal closes — it races
    // with auth-store reactivity on a revenue-critical surface.
    if (!auth.isLoggedIn) {
      authModal?.open();
      return;
    }
    void handleSubscribe();
  }

  function handleDismiss() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      void goto("/");
    }
  }

  const benefits = [
    {
      title: "All convention bundles unlocked",
      body: "Practice every bundle — Stayman, Jacoby Transfers, Blackwood, Bergen Raises, Weak Twos, Strong 2♣, and more. Free tier is limited to a small SAYC starter set.",
    },
    {
      title: "Full practice configuration",
      body: "Pick role, practice mode, play profile, and vulnerability. Tune drills to the weakness you want to work on.",
    },
    {
      title: "System selection",
      body: "Switch between SAYC and 2-over-1 Game Force anywhere the system fact ladder applies — the same convention, adapted to your system.",
    },
    {
      title: "Support an indie tool",
      body: "Subscriptions fund ongoing convention authoring, teaching improvements, and upcoming features like progress tracking and custom practice packs.",
    },
  ];
</script>

<svelte:head>
  <title>BridgeLab — Pricing</title>
</svelte:head>

<AppScreen width="form">
  <div class="flex flex-col gap-6 pb-6">
    <header class="text-center">
      <h1 class="text-[--text-title] font-semibold text-text-primary">
        Practice every convention, your way.
      </h1>
      <p class="mt-2 text-[--text-body] text-text-secondary">
        Unlock the full BridgeLab practice experience.
      </p>
      <p class="mt-4 text-[--text-heading] font-semibold text-text-primary">
        {MONTHLY_PRICE_DISPLAY}
      </p>
    </header>

    <ul class="flex flex-col gap-3 list-none p-0 m-0">
      {#each benefits as benefit (benefit.title)}
        <li>
          <CardSurface class="p-4">
            <h2 class="text-[--text-body] font-semibold text-text-primary">
              {benefit.title}
            </h2>
            <p class="mt-1 text-[--text-detail] text-text-secondary leading-relaxed">
              {benefit.body}
            </p>
          </CardSurface>
        </li>
      {/each}
    </ul>

    <div class="flex flex-col gap-2">
      <button
        class="w-full py-3 rounded-[--radius-md] text-[--text-body] font-semibold transition-colors cursor-pointer
          text-text-on-accent bg-accent-primary hover:bg-accent-primary-hover shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isStartingCheckout}
        onclick={handlePrimaryClick}
        data-testid={auth.isLoggedIn ? "pricing-subscribe" : "pricing-signin"}
      >
        {#if !auth.isLoggedIn}
          Sign in to subscribe
        {:else if isStartingCheckout}
          Redirecting…
        {:else}
          Subscribe — {MONTHLY_PRICE_DISPLAY}
        {/if}
      </button>
      <button
        class="w-full py-2 rounded-[--radius-md] text-[--text-detail] font-medium transition-colors cursor-pointer
          text-text-muted hover:text-text-primary"
        onclick={handleDismiss}
        data-testid="pricing-dismiss"
      >
        Maybe later
      </button>
    </div>

    {#if errorMessage}
      <p class="text-[--text-detail] text-red-400 text-center" role="alert">{errorMessage}</p>
    {/if}
  </div>
</AppScreen>

<AuthModal bind:this={authModal} />
