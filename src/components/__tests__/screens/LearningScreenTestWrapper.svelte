<script lang="ts">
  import "../../../conventions/index";
  import { setEngine, setGameStore, setAppStore, setService } from "../../../stores/context";
  import type { EnginePort } from "../../../service";
  import type { createGameStore } from "../../../stores/game.svelte";
  import type { createAppStore } from "../../../stores/app.svelte";
  import type { DevServicePort } from "../../../service";
  import LearningScreen from "../../screens/LearningScreen.svelte";

  interface Props {
    engine: EnginePort;
    gameStore: ReturnType<typeof createGameStore>;
    appStore: ReturnType<typeof createAppStore>;
    service?: DevServicePort;
  }

  let props: Props = $props();

  setEngine(props.engine);
  setGameStore(props.gameStore);
  setAppStore(props.appStore);
  if (props.service) setService(props.service);
</script>

<LearningScreen />
