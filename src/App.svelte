<script lang="ts">
  import { TsEngine } from "./engine/ts-engine";
  import { createGameStore } from "./stores/game.svelte";
  import { createAppStore } from "./stores/app.svelte";
  import { setEngine, setGameStore, setAppStore } from "./lib/context";
  import ConventionSelectScreen from "./components/screens/ConventionSelectScreen.svelte";
  import GameScreen from "./components/screens/GameScreen.svelte";
  import ExplanationScreen from "./components/screens/ExplanationScreen.svelte";

  const engine = new TsEngine();
  const gameStore = createGameStore(engine);
  const appStore = createAppStore();

  setEngine(engine);
  setGameStore(gameStore);
  setAppStore(appStore);
</script>

<div class="min-h-screen bg-bg-deepest text-text-primary font-sans">
  {#if appStore.screen === "select"}
    <ConventionSelectScreen />
  {:else if appStore.screen === "game"}
    <GameScreen />
  {:else if appStore.screen === "explanation"}
    <ExplanationScreen />
  {/if}
</div>
