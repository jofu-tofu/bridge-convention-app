<script lang="ts">
  import type { DevServicePort } from "./service";
  import type { createGameStore } from "./stores/game.svelte";
  import type { createAppStore } from "./stores/app.svelte";
  import type { createCustomSystemsStore } from "./stores/custom-systems.svelte";
  import type { createUserModuleStore } from "./stores/user-modules.svelte";
  import type { createPracticePacksStore } from "./stores/practice-packs.svelte";
  import type { createAuthStore } from "./stores/auth.svelte";
  import { setGameStore, setAppStore, setService, setCustomSystemsStore, setUserModuleStore, setPracticePacksStore, setAuthStore } from "./stores/context";
  import { DESKTOP_MIN } from "./components/shared/breakpoints.svelte";
  import NavRail from "./components/navigation/NavRail.svelte";
  import BottomTabBar from "./components/navigation/BottomTabBar.svelte";
  import ConventionSelectScreen from "./components/screens/ConventionSelectScreen.svelte";
  import GameScreen from "./components/screens/game-screen/GameScreen.svelte";
  import LearningScreen from "./components/screens/LearningScreen.svelte";
  import SettingsScreen from "./components/screens/SettingsScreen.svelte";
  import CoverageScreen from "./components/screens/CoverageScreen.svelte";
  import WorkshopScreen from "./components/screens/WorkshopScreen.svelte";
  import ConventionEditorScreen from "./components/screens/ConventionEditorScreen.svelte";
  import PracticePackEditorScreen from "./components/screens/PracticePackEditorScreen.svelte";


  interface Props {
    service: DevServicePort;
    gameStore: ReturnType<typeof createGameStore>;
    appStore: ReturnType<typeof createAppStore>;
    customSystemsStore: ReturnType<typeof createCustomSystemsStore>;
    userModuleStore: ReturnType<typeof createUserModuleStore>;
    practicePacksStore: ReturnType<typeof createPracticePacksStore>;
    authStore: ReturnType<typeof createAuthStore>;
  }

  const props: Props = $props();

  setService(props.service);
  setGameStore(props.gameStore);
  setAppStore(props.appStore);
  setCustomSystemsStore(props.customSystemsStore);
  setUserModuleStore(props.userModuleStore);
  setPracticePacksStore(props.practicePacksStore);
  setAuthStore(props.authStore);

  let innerW = $state(1024);
  const isDesktop = $derived(innerW >= DESKTOP_MIN);
</script>

{#snippet screenRouter()}
  {#if props.appStore.screen === "game"}
    <GameScreen />
  {:else if props.appStore.screen === "conventions"}
    <ConventionSelectScreen />
  {:else if props.appStore.screen === "learning"}
    <LearningScreen />
  {:else if props.appStore.screen === "settings"}
    <SettingsScreen />
  {:else if props.appStore.screen === "coverage"}
    <CoverageScreen />
  {:else if props.appStore.screen === "workshop" || props.appStore.screen === "profiles"}
    <WorkshopScreen />
  {:else if props.appStore.screen === "convention-editor"}
    <ConventionEditorScreen />
  {:else if props.appStore.screen === "practice-pack-editor"}
    <PracticePackEditorScreen />
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
      <div class="flex-1 min-w-0 min-h-0 overflow-hidden">
        {@render screenRouter()}
      </div>
      <BottomTabBar />
    </div>
  {/if}
</div>
