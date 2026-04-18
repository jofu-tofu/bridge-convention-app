<script lang="ts">
  import type { Snippet } from "svelte";
  import type { DevServicePort } from "./service";
  import type { createGameStore } from "./stores/game.svelte";
  import type { createAppStore } from "./stores/app.svelte";
  import type { createCustomSystemsStore } from "./stores/custom-systems.svelte";
  import type { createUserModuleStore } from "./stores/user-modules.svelte";
  import type { createDrillsStore } from "./stores/drills.svelte";
  import type { createAuthStore } from "./stores/auth.svelte";
  import {
    setService,
    setGameStore,
    setAppStore,
    setCustomSystemsStore,
    setUserModuleStore,
    setDrillsStore,
    setAuthStore,
  } from "./stores/context";

  interface Props {
    service: DevServicePort;
    gameStore: ReturnType<typeof createGameStore>;
    appStore: ReturnType<typeof createAppStore>;
    customSystemsStore: ReturnType<typeof createCustomSystemsStore>;
    userModuleStore: ReturnType<typeof createUserModuleStore>;
    drillsStore: ReturnType<typeof createDrillsStore>;
    authStore: ReturnType<typeof createAuthStore>;
    children: Snippet;
  }

  const props: Props = $props();

  // setContext must be called during component initialization
  setService(props.service);
  setGameStore(props.gameStore);
  setAppStore(props.appStore);
  setCustomSystemsStore(props.customSystemsStore);
  setUserModuleStore(props.userModuleStore);
  setDrillsStore(props.drillsStore);
  setAuthStore(props.authStore);
</script>

{@render props.children()}
