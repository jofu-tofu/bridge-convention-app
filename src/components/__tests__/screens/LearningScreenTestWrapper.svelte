<script lang="ts">
  import "../../../conventions/index";
  import { setEngine, setGameStore, setAppStore } from "../../../stores/context";
  import type { EnginePort } from "../../../engine/port";
  import type { createGameStore } from "../../../stores/game.svelte";
  import type { createAppStore } from "../../../stores/app.svelte";
  import LearningScreen from "../../screens/LearningScreen.svelte";

  interface Props {
    engine: EnginePort;
    gameStore: ReturnType<typeof createGameStore>;
    appStore: ReturnType<typeof createAppStore>;
  }

  let props: Props = $props();

  setEngine(props.engine);
  setGameStore(props.gameStore);
  setAppStore(props.appStore);
</script>

<LearningScreen />
