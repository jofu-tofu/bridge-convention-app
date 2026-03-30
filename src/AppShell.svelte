<script lang="ts">
  import type { DevServicePort } from "./service";
  import type { createGameStore } from "./stores/game.svelte";
  import type { createAppStore } from "./stores/app.svelte";
  import { setGameStore, setAppStore, setService } from "./stores/context";
  import { DESKTOP_MIN } from "./components/shared/breakpoints.svelte";
  import NavRail from "./components/navigation/NavRail.svelte";
  import BottomTabBar from "./components/navigation/BottomTabBar.svelte";
  import LearnSubNav from "./components/navigation/LearnSubNav.svelte";
  import ConventionSelectScreen from "./components/screens/ConventionSelectScreen.svelte";
  import GameScreen from "./components/screens/game-screen/GameScreen.svelte";
  import LearningScreen from "./components/screens/LearningScreen.svelte";
  import SettingsScreen from "./components/screens/SettingsScreen.svelte";
  import CoverageScreen from "./components/screens/CoverageScreen.svelte";
  import ProfilesScreen from "./components/screens/ProfilesScreen.svelte";
  import PracticeModePicker from "./components/screens/PracticeModePicker.svelte";

  interface Props {
    service: DevServicePort;
    gameStore: ReturnType<typeof createGameStore>;
    appStore: ReturnType<typeof createAppStore>;
  }

  const props: Props = $props();

  setService(props.service);
  setGameStore(props.gameStore);
  setAppStore(props.appStore);

  let innerW = $state(1024);
  const isDesktop = $derived(innerW >= DESKTOP_MIN);
  const showLearnSubNav = $derived(
    !isDesktop &&
    (props.appStore.screen === "learning" || props.appStore.screen === "profiles"),
  );
</script>

{#snippet screenRouter()}
  {#if props.appStore.screen === "game"}
    <GameScreen />
  {:else if props.appStore.screen === "practice-picker"}
    <div class="flex h-full items-center justify-center p-6">
      <PracticeModePicker
        conventionName={props.appStore.selectedConvention?.name ?? ""}
        supportsRoleSelection={props.appStore.selectedConvention?.supportsRoleSelection}
        onSelect={(mode, role) => props.appStore.confirmPracticeMode(mode, role)}
        onCancel={() => props.appStore.cancelPracticeMode()}
      />
    </div>
  {:else if props.appStore.screen === "conventions"}
    <ConventionSelectScreen />
  {:else if props.appStore.screen === "learning"}
    <LearningScreen />
  {:else if props.appStore.screen === "settings"}
    <SettingsScreen />
  {:else if props.appStore.screen === "coverage"}
    <CoverageScreen />
  {:else if props.appStore.screen === "profiles"}
    <ProfilesScreen />
  {:else}
    <div class="flex h-full items-center justify-center text-red-400">
      <p>Unknown screen: {props.appStore.screen}</p>
    </div>
  {/if}
{/snippet}

<svelte:window bind:innerWidth={innerW} />

<div class="bg-bg-deepest text-text-primary h-screen overflow-hidden font-sans">
  {#if isDesktop}
    <div class="flex h-full">
      <NavRail />
      <div class="flex-1 min-w-0 h-full overflow-hidden">
        {@render screenRouter()}
      </div>
    </div>
  {:else}
    <div class="flex flex-col h-full">
      {#if showLearnSubNav}
        <LearnSubNav />
      {/if}
      <div class="flex-1 min-w-0 min-h-0 overflow-hidden">
        {@render screenRouter()}
      </div>
      <BottomTabBar />
    </div>
  {/if}
</div>
