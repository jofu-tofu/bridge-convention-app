<script lang="ts">
  import type { Snippet } from "svelte";
  import { setEngine, setGameStore, setAppStore } from "../../stores/context";
  import type { EnginePort } from "../../engine/port";
  import type { createGameStore } from "../../stores/game.svelte";
  import type { createAppStore } from "../../stores/app.svelte";

  interface Props {
    engine: EnginePort;
    gameStore: ReturnType<typeof createGameStore>;
    appStore: ReturnType<typeof createAppStore>;
    children: Snippet;
  }

  let props: Props = $props();

  setEngine(props.engine);
  setGameStore(props.gameStore);
  setAppStore(props.appStore);
</script>

{@render props.children()}
