<script lang="ts">
  import { getAuthStore } from "../../../stores/context";
  import { SubscriptionTier } from "../../../service";
  import ContinueCard from "./ContinueCard.svelte";
  import QuickActions from "./QuickActions.svelte";
  import YourSystems from "./YourSystems.svelte";
  import YourPacks from "./YourPacks.svelte";

  const auth = getAuthStore();
  const user = $derived(auth.user);
  const isPremium = $derived(user?.subscription === SubscriptionTier.Premium);
  const tierLabel = $derived(
    user?.subscription === SubscriptionTier.Premium
      ? "Premium"
      : user?.subscription === SubscriptionTier.Expired
        ? "Expired"
        : "Free"
  );
</script>

<svelte:head>
  <title>BridgeLab — Home</title>
</svelte:head>

<header class="header">
  <h1>Welcome back{user?.display_name ? `, ${user.display_name}` : ""}</h1>
  <span class="tier" class:premium={isPremium}>{tierLabel}</span>
</header>

<div class="grid">
  <div class="primary">
    <ContinueCard />
    <QuickActions />
  </div>
  <aside class="secondary">
    <YourSystems />
    <YourPacks />
    <!-- reserved space: streaks, suggestions, promoted guides -->
  </aside>
</div>

<style>
  .header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }
  h1 {
    font-size: clamp(1.5rem, 3vw, 2rem);
    color: var(--color-text-primary);
    margin: 0;
  }
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
  .tier.premium {
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
