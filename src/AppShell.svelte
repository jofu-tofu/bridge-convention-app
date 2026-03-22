<script lang="ts">
  import type { EnginePort } from "./engine/port";
  import type { DevServicePort } from "./service";
  import type { createGameStore } from "./stores/game.svelte";
  import type { createAppStore } from "./stores/app.svelte";
  import { setEngine, setGameStore, setAppStore, setService } from "./stores/context";
  import ConventionSelectScreen from "./components/screens/ConventionSelectScreen.svelte";
  import GameScreen from "./components/screens/game-screen/GameScreen.svelte";
  import LearningScreen from "./components/screens/LearningScreen.svelte";
  import SettingsScreen from "./components/screens/SettingsScreen.svelte";
  import CoverageScreen from "./components/screens/CoverageScreen.svelte";

  interface Props {
    engine: EnginePort;
    service: DevServicePort;
    gameStore: ReturnType<typeof createGameStore>;
    appStore: ReturnType<typeof createAppStore>;
  }

  const props: Props = $props();

  setEngine(props.engine);
  setService(props.service);
  setGameStore(props.gameStore);
  setAppStore(props.appStore);
</script>

<div class="bg-bg-deepest text-text-primary h-screen overflow-hidden font-sans">
  {#if props.appStore.screen === "select"}
    <ConventionSelectScreen />
  {:else if props.appStore.screen === "game"}
    <GameScreen />
  {:else if props.appStore.screen === "learning"}
    <LearningScreen />
  {:else if props.appStore.screen === "settings"}
    <SettingsScreen />
  {:else if props.appStore.screen === "coverage"}
    <CoverageScreen />
  {:else}
    <div class="flex h-screen items-center justify-center text-red-400">
      <p>Unknown screen: {props.appStore.screen}</p>
    </div>
  {/if}
</div>
