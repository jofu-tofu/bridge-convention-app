<script lang="ts">
  import ConventionSelectScreen from "../../screens/ConventionSelectScreen.svelte";
  import {
    setAppStore,
    setAuthStore,
    setCustomSystemsStore,
    setDrillsStore,
  } from "../../../stores/context";
  import type { createAppStore } from "../../../stores/app.svelte";
  import type { createAuthStore } from "../../../stores/auth.svelte";
  import type { createCustomSystemsStore } from "../../../stores/custom-systems.svelte";
  import type { createDrillsStore } from "../../../stores/drills.svelte";

  interface Props {
    appStore: ReturnType<typeof createAppStore>;
    authStore: ReturnType<typeof createAuthStore>;
    customSystemsStore: ReturnType<typeof createCustomSystemsStore>;
    drillsStore: ReturnType<typeof createDrillsStore>;
  }

  const { appStore, authStore, customSystemsStore, drillsStore }: Props = $props();

  setAppStore(appStore);
  setAuthStore(authStore);
  setCustomSystemsStore(customSystemsStore);
  setDrillsStore(drillsStore);
</script>

<ConventionSelectScreen />
