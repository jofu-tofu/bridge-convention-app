<script lang="ts">
  import type { EnginePort } from "./engine/port";
  import type { createGameStore } from "./stores/game.svelte";
  import type { createAppStore } from "./stores/app.svelte";
  import { setEngine, setGameStore, setAppStore } from "./stores/context";
  import ConventionSelectScreen from "./components/screens/ConventionSelectScreen.svelte";
  import GameScreen from "./components/screens/game-screen/GameScreen.svelte";
  import LearningScreen from "./components/screens/LearningScreen.svelte";

  interface Props {
    engine: EnginePort;
    gameStore: ReturnType<typeof createGameStore>;
    appStore: ReturnType<typeof createAppStore>;
  }

  let { engine, gameStore, appStore }: Props = $props();

  // setContext() called synchronously during this component's init.
  // Props are stable (App.svelte only mounts AppShell once engine is resolved).
  setEngine(engine);
  setGameStore(gameStore);
  setAppStore(appStore);
</script>

<div class="bg-bg-deepest text-text-primary h-screen overflow-hidden font-sans">
  {#if appStore.screen === "select"}
    <ConventionSelectScreen />
  {:else if appStore.screen === "game"}
    <GameScreen />
  {:else if appStore.screen === "learning"}
    <LearningScreen />
  {/if}
</div>
