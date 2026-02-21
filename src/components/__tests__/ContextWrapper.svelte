<script lang="ts">
  import type { Snippet } from "svelte";
  import { setEngine, setGameStore, setAppStore } from "../../lib/context";
  import type { EnginePort } from "../../engine/port";

  interface Props {
    engine: EnginePort;
    gameStore: unknown;
    appStore: unknown;
    children: Snippet;
  }

  let { engine, gameStore, appStore, children }: Props = $props();

  setEngine(engine);
  setGameStore(gameStore);
  setAppStore(appStore);
</script>

{@render children()}
