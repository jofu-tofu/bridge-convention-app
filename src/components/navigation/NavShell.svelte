<script lang="ts">
  import type { Snippet } from "svelte";
  import { DESKTOP_MIN } from "../shared/breakpoints.svelte";
  import { getAppStore } from "../../stores/context";
  import NavRail from "./NavRail.svelte";
  import BottomTabBar from "./BottomTabBar.svelte";
  import LearnSubNav from "./LearnSubNav.svelte";

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();
  const appStore = getAppStore();

  let innerW = $state(1024);
  const isDesktop = $derived(innerW >= DESKTOP_MIN);
  const showLearnSubNav = $derived(
    !isDesktop &&
    (appStore.screen === "learning" || appStore.screen === "profiles"),
  );
</script>

<svelte:window bind:innerWidth={innerW} />

{#if isDesktop}
  <div class="flex h-full">
    <NavRail />
    <div class="flex-1 min-w-0 h-full overflow-hidden">
      {@render children()}
    </div>
  </div>
{:else}
  <div class="flex flex-col h-full">
    {#if showLearnSubNav}
      <LearnSubNav />
    {/if}
    <div class="flex-1 min-w-0 min-h-0 overflow-hidden">
      {@render children()}
    </div>
    <BottomTabBar />
  </div>
{/if}
