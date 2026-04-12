<script lang="ts">
  import { browser } from "$app/environment";
  import { getAuthStoreOptional } from "../../stores/context";
  import MarketingHero from "../../components/screens/landing/MarketingHero.svelte";
  import LoggedInLanding from "../../components/screens/landing/LoggedInLanding.svelte";

  const auth = browser ? getAuthStoreOptional() : undefined;
  const showLoggedIn = $derived(!!auth?.isLoggedIn);
</script>

{#if showLoggedIn}
  <LoggedInLanding />
{:else}
  <MarketingHero />
{/if}
