<script lang="ts">
  import { getAuthStore } from "../../../stores/context";
  import { SubscriptionTier } from "../../../service";
  import ContinueCard from "./ContinueCard.svelte";
  import QuickActions from "./QuickActions.svelte";
  import YourSystems from "./YourSystems.svelte";
  import YourPacks from "./YourPacks.svelte";
  import ContentScreen from "../../shared/ContentScreen.svelte";

  const auth = getAuthStore();
  const user = $derived(auth.user);
  const isPaid = $derived(user?.subscription_tier === SubscriptionTier.Paid);
  const tierLabel = $derived(
    user?.subscription_tier === SubscriptionTier.Paid
      ? "Paid"
      : user?.subscription_tier === SubscriptionTier.Expired
        ? "Expired"
        : "Free"
  );
</script>

<svelte:head>
  <title>BridgeLab — Home</title>
</svelte:head>

<ContentScreen title={`Welcome back${user?.display_name ? `, ${user.display_name}` : ""}`}>
  {#snippet actions()}
    <span class="tier" class:paid={isPaid}>{tierLabel}</span>
  {/snippet}
  <div class="grid">
    <div class="primary">
      <ContinueCard />
      <QuickActions />
    </div>
    <aside class="secondary">
      <YourSystems />
      <YourPacks />
    </aside>
  </div>
</ContentScreen>

<style>
  .tier {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    border: 1px solid var(--color-border-muted, rgba(148, 163, 184, 0.3));
    color: var(--color-text-secondary);
  }
  .tier.paid {
    color: var(--color-accent-primary);
    border-color: var(--color-accent-primary);
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  .primary {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .secondary {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  @media (min-width: 768px) {
    .grid {
      grid-template-columns: 2fr 1fr;
    }
  }
</style>
